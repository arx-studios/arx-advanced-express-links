# 6. Security

## Authentication

| Aspect | How it works |
|---|---|
| Identity provider | Supabase Auth in the **ARX Studios** project (the same accounts as arxstudios.pro) |
| Methods | Google OAuth, email magic link |
| Session | Supabase session cookie, set by `/auth/callback`, refreshed by `proxy.ts` |
| Verification | `getClaims()` verifies the JWT signature locally against the project's public keys (ECC P-256, from its JWKS endpoint). Tampering with the user id breaks the signature. |
| Where sign-in can return to | Only URLs on the auth project's **Redirect URLs** list: `https://axl.arxstudios.pro/auth/callback` and `http://localhost:3000/auth/callback` |

The auth project's legacy HS256 shared-secret key is only a "previous key"; tokens are
signed with the asymmetric key, which is why axl can verify them without any secret.

## Authorization

| Resource | Rule | Enforced in |
|---|---|---|
| Open a short link | Anyone | `app/[code]/route.ts` (no auth) |
| Create a link | Signed in | `POST /api/links` |
| List, view, delete links | Signed in, **own links only** | every query filters by `owner_id` |
| Another user's link | Returns `404`, same as a missing one, so codes can't be probed | `GET/DELETE /api/links/[code]` |
| Keep-alive job | Holder of `CRON_SECRET` | `app/api/cron/keepalive/route.ts` |

Ownership lives in the SQL (`WHERE code = $1 AND owner_id = $2`), not in a check done
after loading the row, so there's no way to act on a row without owning it.

## Database access control

- **Supabase's public API is shut out.** RLS is enabled with no policies on `users`,
  `links` and `schema_migrations`, so the auto-generated REST API returns nothing, even
  with the public publishable key. The app connects as the table owner, which bypasses
  RLS.
- **SQL injection:** every query uses parameters (`$1, $2`), never string building. The
  pagination cursor is additionally validated as digits only.

## Transport security

| Connection | Protection |
|---|---|
| Browser → axl | HTTPS; Let's Encrypt certificate issued and renewed by Vercel |
| App → Postgres | TLS **verified** against Supabase's root CA (`DATABASE_CA_CERT`), `rejectUnauthorized: true`. Checked in production: a wrong CA is refused ("self-signed certificate in certificate chain"). |
| Laptop → Postgres (migrations) | Same verified TLS, with the CA file in `certs/` |
| App → Redis | TLS (`rediss://`) plus the instance password |
| App → auth project | HTTPS |

`lib/pgConnection.ts` strips `sslmode` and related parameters from the database URL
when a CA is given. Otherwise `pg` would let the URL's SSL settings silently override
the verified-TLS configuration.

**Redis network access:** the Render instance accepts connections from `0.0.0.0/0`,
because Vercel's outbound IPs change constantly. Protection comes from the password and
TLS. A dedicated egress IP (a paid Vercel feature) would allow a tight allowlist.

## Input validation

| Input | Checks |
|---|---|
| Request body | Must be valid JSON; zod schema (`url` ≤ 2,048 chars, `alias` pattern, `expiresAt` a date) |
| Destination URL | Parsed with `URL`; only `http:`/`https:`; can't point back to axl (no redirect loops, and no disguised `javascript:` links) |
| Alias | `^[A-Za-z0-9_-]{3,32}$`, and not a reserved word (`api`, `auth`, `dashboard`, `signin`, `privacy`, …) |
| Expiry | Must be in the future |
| Short code on redirect | Same pattern; anything else is a fast 404 that never reaches Redis or Postgres |
| Cursor | Digits only, up to 19 |

## Frontend

- Server data is inserted with React (escaped), never as raw HTML, so link text can't
  inject scripts.
- The "Link not found" page is static HTML with no user input in it.

## Abuse and rate limits

- **10 new links per minute per user** (Redis, fixed window), `429` with `Retry-After`.
- Sign-in is required to create links, which ties every link to an account.
- The shorten form ignores repeat clicks while a request is pending and answers repeat
  URLs from memory.
- The rate limiter fails open during a Redis outage (a deliberate availability choice).

⚠️ **Known gap: link abuse.** A shortener on your own domain can be used for phishing.
If harmful links are spread through `axl.arxstudios.pro`, Google Safe Browsing could
flag **`arxstudios.pro` as a whole**. Possible additions: a Google Safe Browsing check
on create, a "report this link" page, and an admin view to disable links.

## Secrets

| Secret | Lives in | Never in |
|---|---|---|
| `DATABASE_URL` (includes the DB password) | Vercel env (Production); local `.env.supabase` | Git, chat |
| `REDIS_URL` (includes the password) | Vercel env (Production); local `.env.render` | Git, chat |
| `CRON_SECRET` | Vercel env (Production) | Git, chat |
| Supabase root CA | Vercel env; local `certs/` | Git (it's public, but kept out anyway) |
| Publishable key | Vercel env, browser bundle | (public by design) |

`.gitignore` covers `.env*` (except `.env.example`) and `certs/`. The full Git history
was scanned before publishing to GitHub: no secrets.

**The auth project's `sb_secret_…` key was pasted into a chat during development.**
axl never uses it, but it grants full admin access to the ARX Studios project and should
be **rotated** (Project Settings → API Keys).

## Keep-alive endpoint

- Rejects any request without `Authorization: Bearer <CRON_SECRET>`; the comparison is
  constant-time (`timingSafeEqual`).
- With no `CRON_SECRET` configured, the endpoint stays closed.
- The worst an attacker could do with the endpoint is make it run once more.
