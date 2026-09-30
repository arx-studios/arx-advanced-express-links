# 3. System design

This document explains the main design decisions, the alternatives considered, and the
trade-offs accepted.

## Requirements

**Functional**
- Signed-in users create short links, optionally with a custom alias or an expiry.
- Anyone can follow a short link.
- Users can list their links, see click counts, and delete links.

**Non-functional**
- Redirects must be **fast** and **highly available**: they're the product.
- Reads vastly outnumber writes (roughly 100:1 for a typical shortener).
- Short codes must not be guessable or enumerable.
- It must run on free tiers, unattended.

## Rough capacity

At 1 million new links a month:

| Metric | Estimate |
|---|---|
| Writes | ~0.4 per second on average |
| Redirects (100:1) | ~40 per second on average |
| Storage | ~300 bytes per link → ~300 MB per million links |

A single Postgres with a cache in front handles this easily. The free Supabase database
(500 MB) holds well over a million links.

## Short codes

**Choice: 7 random characters from base62** (`0-9a-zA-Z`), using `crypto.randomInt`
(`lib/shortCode.ts`).

- 62⁷ ≈ **3.5 trillion** possible codes.
- `crypto.randomInt` is cryptographically secure *and* uniform. The common
  `bytes[i] % 62` shortcut is biased, because 256 isn't divisible by 62.

| Alternative | Why not |
|---|---|
| Auto-increment ID → base62 | Codes are sequential, so anyone can enumerate every link by counting up |
| Hash of the URL | Collisions, and the same URL always gets the same code, which rules out separate links |
| Snowflake-style IDs | Solves a scale problem axl doesn't have |

**Collisions.** At 10 million links, a new random code hits an existing one about
1 time in 350,000. The database enforces uniqueness (`code UNIQUE`). The service
simply tries to insert, and on a unique violation (`23505`) retries with a new code,
up to 5 times. Checking first ("SELECT, then INSERT if free") would race; letting the
database referee doesn't.

**Custom aliases** use the same column. A collision there isn't bad luck, it means the
alias is taken, so it returns `409 Conflict` instead of retrying.

## Validating destination URLs

`lib/targetUrl.ts` parses with the built-in `URL` class and rejects:
- anything that isn't `http:` or `https:` (for example `javascript:`, `file:`, `data:`);
- links pointing back to axl itself (to prevent redirect loops);
- URLs over 2,048 characters (validated in the route).

The URL is stored normalized (`new URL(x).toString()`), so `https://GitHub.com` and
`https://github.com/` are the same URL.

## Dedupe: one link per user per URL

Shortening the same URL twice returns the existing link (`200` instead of `201`).

**Scope: per user.** Global dedupe would make two users share a code, and so share
click stats, and let one user's delete break the other's link. Links with an **alias**
or an **expiry** are never deduplicated: an alias is deliberately distinct, and two
links with different expiries can't be the same row.

**Mechanism** (race-free, enforced by the database):

```sql
CREATE UNIQUE INDEX links_canonical_idx
  ON links (owner_id, sha256(long_url::bytea))
  WHERE is_canonical;
```

- A **partial** index: uniqueness only applies to canonical rows.
- An **expression** index on a hash: Postgres index entries are capped at about 2.7 KB,
  and a 32-byte hash is smaller and faster to compare than a 2,000-character URL.
- Inserts use `ON CONFLICT … DO NOTHING RETURNING *`. No row back means someone else
  created it first, so the service fetches and returns theirs. A test fires 3
  simultaneous requests for the same new URL and checks they all get one code.
- Lookups also compare `long_url` itself, so even a (practically impossible) hash
  collision can't return the wrong link.

The browser adds its own layer: the shorten form remembers URLs it has already
shortened, so repeat clicks never reach the server.

## Redirects: 302, not 301

A `301 Moved Permanently` is cached by browsers forever. The second visit never reaches
axl, so it's never counted, and the link could never be deleted or expire. axl uses
**`302 Found`**.

## Caching (cache-aside)

```
resolve(code):
  1. GET link:<code> from Redis        → hit: return it (no database)
  2. miss → SELECT from Postgres
  3. SET link:<code> in Redis with a TTL
  4. return
```

| Detail | Choice | Why |
|---|---|---|
| TTL | 24 hours | Long enough to absorb traffic, short enough to self-heal |
| Expiring links | TTL = min(24h, time until expiry) | A cached link must not outlive its expiry |
| Negative caching | Unknown codes cached as `__none__` for 60s | Bots probing random codes would otherwise all hit Postgres |
| Invalidation on create | `DEL link:<code>` after insert | Clears a "doesn't exist" entry cached just before the alias was created |
| Invalidation on delete | `DEL link:<code>` after soft delete | Deleted links stop working immediately, not in 24h |
| Eviction policy | `allkeys-lru` | When the 25 MB fill up, old entries are dropped instead of writes failing |

## Click counting: buffer, then batch

Writing to Postgres on every redirect would slow redirects down, and a viral link would
turn one row into a lock-contention hot spot.

1. On redirect, **after the response is sent** (Next.js `after()`), `INCR clicks:<code>`
   in Redis. The visitor never waits for it.
2. In the same `after()` block, try `SET lock:click-flush 1 NX EX 10`. The request that
   wins (at most one every 10 seconds) **flushes**: it walks `clicks:*` with `SCAN`
   (never the blocking `KEYS`), reads and deletes each counter atomically with `GETDEL`,
   and adds it to Postgres in one `UPDATE … SET click_count = click_count + n`.
3. The **daily keep-alive cron** also flushes, so counters don't wait in Redis on quiet
   days.
4. The dashboard shows `click_count + buffered counter`, read with one `MGET` per page,
   so counts are live.

A serverless app has no background timers, which is why the flush is triggered by
traffic (the lock) and by the cron, instead of `setInterval`.

**Trade-off: at-most-once.** If the Postgres update fails after `GETDEL`, those clicks
are lost; if Redis restarts, un-flushed clicks are lost. That's acceptable for click
statistics, but it wouldn't be for money.

## Rate limiting

Fixed window, per signed-in user: **10 new links per minute** by default
(`CREATE_LINKS_PER_MINUTE`).

```
MULTI
  INCR   ratelimit:create:<userId>
  EXPIRE ratelimit:create:<userId> 60 NX   ← only set on the first hit
  TTL    ratelimit:create:<userId>
EXEC
```

Doing the counter and its expiry in one transaction means a key can never be left
without a TTL, which would block a user forever. Over the limit returns `429` with a
`Retry-After` header, and the UI shows "try again in 42s".

The limiter **fails open**: if Redis doesn't answer within 1 second, the request is
allowed. Everyone is signed in, so an outage shouldn't stop link creation.

Counters live in Redis, not in memory: with several Vercel instances, per-instance
limits would multiply the real limit.

## Soft delete

Deleting sets `deleted_at` and clears `is_canonical`. The row stays forever, so **its
code is never reused**. With a hard delete, someone could claim a popular deleted
alias, and every copy of the old link (in tweets, emails, printed QR codes) would
silently redirect to their site.

Clearing `is_canonical` lets the owner shorten the same URL again and get a fresh code.

## Pagination

Keyset pagination: `WHERE owner_id = $1 AND id < $cursor ORDER BY id DESC LIMIT 21`.
Fetching one extra row tells whether another page exists. Unlike `OFFSET`, this stays
fast on page 1,000 and doesn't skip or repeat rows when links are created in between.
It's backed by the partial index `links (owner_id, id DESC) WHERE deleted_at IS NULL`.

## Authentication design

- Sign-in happens in the **ARX Studios** Supabase project. axl's own database has no
  auth: it stores a copy of the user's id and email in `users`.
- Every request carries the session in a cookie. `getClaims()` verifies the JWT's
  signature **locally** against the project's public keys (ECC P-256, fetched once and
  cached), so there's no call to Supabase per request.
- `users` is a local table, not a foreign key to `auth.users`, because that table lives
  in a different project. It also keeps local development and the schema portable.

## Failure handling

The guiding rule: **Redis is a cache, not a source of truth.** Losing it must not take
links down.

| Failure | Behaviour |
|---|---|
| Redis unreachable or slow | Cache reads give up after **500 ms** and use Postgres; cache writes are skipped; the rate limiter allows the request; the dashboard shows database click counts |
| Fresh instance, Redis still logging in | Same as above for its first requests; later requests use the cache |
| Redis restarted (free tier, data lost) | The cache refills on demand; up to ~10s of un-flushed clicks lost |
| Postgres unreachable | Creates and dashboard fail (500); cached redirects keep working for up to 24h |
| Supabase auth project down | Sign-in fails; existing sessions keep working until they need a refresh; redirects unaffected |

### Redis connection and timeouts

Render's external Key Value endpoint takes **2–5 seconds to accept `AUTH`** on every new
connection; every other command takes milliseconds. ioredis sends `AUTH` as an ordinary
command, so a client-wide `commandTimeout` of 500 ms made every login time out and
reconnect in an endless loop. Fresh Vercel instances never got a working connection.

The fix (commit `fa22565`):
- **No `commandTimeout`** on the client: the connection can take the time it needs.
- Callers bound their own waits with `withTimeout()`: **500 ms** for cache calls,
  **1 s** for the rate limiter. A timed-out command isn't cancelled; it still runs once
  the connection is ready.
- The keep-alive cron waits up to **10 s** for the connection before using it.

Measured with Redis stopped: redirects are served from Postgres in about 0.2–0.5 s
instead of hanging, and recover instantly when Redis returns.

## Keep-alive

Free Supabase projects pause after a week without **database** activity, and axl depends
on two of them. A daily Vercel Cron job (`vercel.json`, `0 3 * * *` UTC) calls
`/api/cron/keepalive`, which:

1. runs `SELECT count(*) FROM links` on arxExpressLinks;
2. calls `public.keepalive()` in the auth project over its REST API with the
   publishable key. That function writes a one-row heartbeat, so axl needs no
   credentials for the landing page's database;
3. flushes buffered clicks and pings Redis.

A failed Supabase ping makes the run return `500`, so it shows up as failed in
Vercel's cron logs. Pinging `/auth/v1/health` wasn't used, because it doesn't touch the
database and so doesn't count as activity.

## How it would scale

The current design comfortably serves a startup. If traffic grew by orders of magnitude,
the next steps would be:

1. **Paid Redis with persistence**, and serving hot redirects from Vercel's edge.
2. **Postgres read replicas** for cache misses.
3. **Pre-allocated ID ranges or Snowflake IDs** instead of random-and-retry, once
   collisions stop being negligible.
4. **An event stream (Redis Streams or Kafka)** for detailed analytics (referrer,
   country, device) instead of a single counter.
