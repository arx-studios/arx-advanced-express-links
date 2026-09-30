# Building axl — a URL shortener, step by step

> **Historical:** this guide builds the original Fastify version of axl (commit `c185f7a`).
> The app has since moved to Next.js; see the README for the current setup. The concepts
> (layering, cache-aside, click batching, dedupe) all still apply.

You'll build this yourself, one file at a time. Each step has:
- **What & why**: the concept behind it
- **Code**: type it in (typing beats copy-pasting for learning)
- **Check**: how to confirm it works before moving on

Stack: **Node + TypeScript + Fastify + Postgres + Redis**, with Docker Compose for the infra.

```
                ┌──────────────┐   cache hit    ┌─────────┐
  GET /aB3xK9q  │              │ ─────────────► │  Redis  │
 ─────────────► │   Fastify    │ ◄───────────── │ (cache, │
  302 Location  │   server     │                │ clicks) │
 ◄───────────── │              │   cache miss   └─────────┘
                │              │ ─────────────► ┌──────────┐
                └──────────────┘                │ Postgres │  (source of truth)
                                                └──────────┘
```

Final layout you're building toward:

```
src/
  config.ts              env vars, validated
  app.ts                 builds the Fastify app (no network I/O → testable)
  server.ts              entrypoint: connects to DB/Redis, starts listening
  lib/
    shortCode.ts         random base62 code generator
    targetUrl.ts         validates the URL the user wants to shorten
  links/
    linkRepository.ts    SQL lives here and only here
    linkService.ts       business logic: create, resolve (+cache), clicks
    linkRoutes.ts        HTTP: parse request → call service → shape response
    clickFlusher.ts      background job: Redis click counters → Postgres
scripts/migrate.ts       tiny migration runner
migrations/*.sql         schema changes, applied in order
public/index.html        minimal frontend
test/                    vitest tests
```

The layering (**routes → service → repository**) is the most important idea in this project.
Each layer only talks to the one below it:
- **Routes** know HTTP (status codes, request bodies) but not SQL.
- **Service** knows the rules (retry on collision, caching) but not HTTP.
- **Repository** knows SQL but not the rules.

That's why you can swap Postgres for DynamoDB, or HTTP for gRPC, and only touch one layer.

---

## Step 0 — Setup

1. Install **Docker Desktop** (https://www.docker.com/products/docker-desktop) and start it.
2. From the project root:

```bash
cp .env.example .env
docker compose up -d        # starts Postgres (host port 5433) + Redis (6379)
docker compose ps           # both should say "healthy"
```

> **Why port 5433?** You already have a Postgres running on 5432 on this machine. The container
> still listens on 5432 *inside* Docker; `"5433:5432"` maps host 5433 → container 5432.

Dependencies are already installed (`npm install` again if you ever delete `node_modules`):

| Package | Why |
|---|---|
| `fastify` | HTTP framework. Faster than Express, first-class TypeScript and async/await. |
| `pg` | The standard Postgres driver. We write raw SQL on purpose: you learn more than with an ORM. |
| `ioredis` | Redis client. |
| `zod` | Runtime validation. TypeScript types vanish at runtime; zod checks real input. |
| `@fastify/rate-limit` | Rate limiting, backed by Redis so it works across multiple servers. |
| `tsx` | Runs `.ts` files directly in dev, with a watch mode. |
| `vitest` | Test runner. |

### Gotcha: the `.js` extensions in imports
`tsconfig.json` uses `"module": "NodeNext"`, which is how Node actually runs ESM. Node requires
file extensions in relative imports, and TypeScript compiles `foo.ts` → `foo.js`, so you write:

```ts
import { config } from './config.js';   // yes, .js, even though the file is config.ts
```

---

## Step 1 — Config + a "hello" server

### What & why
Every setting that changes between environments (ports, DB URLs) comes from **environment
variables** (see the "Twelve-Factor App"). We validate them **at startup** so a missing
`DATABASE_URL` crashes immediately with a clear error, not 10 minutes later on the first request.

We also split the app into two files:
- `app.ts` **builds** the app but doesn't start it. Tests can create it and fire fake requests with no real network.
- `server.ts` is the **only** file that reads config and opens connections.

### Code

`src/config.ts`
```ts
import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  BASE_URL: z.url(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
});

export const config = EnvSchema.parse(process.env);
```
- Env vars are always strings. `z.coerce.number()` turns `"3000"` into `3000`.
- `.parse()` throws if anything is wrong. That's exactly what we want at boot.
- The type of `config` is **inferred** from the schema. There's no separate interface to keep in sync.

`src/app.ts` (first version; it grows later)
```ts
import Fastify from 'fastify';

export function buildApp() {
  const app = Fastify({ logger: true });
  app.get('/health', async () => ({ status: 'ok' }));
  return app;
}
```

`src/server.ts` (first version)
```ts
import { buildApp } from './app.js';
import { config } from './config.js';

const app = buildApp();
await app.listen({ port: config.PORT, host: '0.0.0.0' });
```
- In Fastify, returning an object from a handler sends it as JSON.
- `host: '0.0.0.0'` listens on all interfaces. That's needed later inside Docker, where `localhost` would only be the container itself.
- Top-level `await` works because `package.json` has `"type": "module"`.

### Check
```bash
npm run dev
curl http://localhost:3000/health     # {"status":"ok"}
```
Try deleting `BASE_URL` from `.env` and watch it crash with a zod error. Then put it back.

---

## Step 2 — Database schema + migrations

### What & why
A **migration** is a versioned SQL file that changes the schema. Files are applied in order,
and each one only once. The DB records which ones already ran, so every environment (your
laptop, CI, prod) ends up with the identical schema. Real projects use tools like
`node-pg-migrate` or Flyway, but they do exactly what our 40-line runner does.

### Code

`migrations/001_create_links.sql`
```sql
CREATE TABLE links (
  id          BIGSERIAL PRIMARY KEY,
  code        VARCHAR(32) NOT NULL UNIQUE,
  long_url    TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ,
  click_count BIGINT      NOT NULL DEFAULT 0
);
```
- `UNIQUE` on `code` does two jobs:
  1. It **guarantees** no two links share a code, even if two servers race each other. App-level checks like "SELECT, then INSERT if missing" can't guarantee that.
  2. It automatically creates a **B-tree index**, so `WHERE code = $1` is a fast O(log n) lookup instead of a full table scan.
- `TIMESTAMPTZ` stores an absolute instant. Always use it over `TIMESTAMP` to dodge timezone bugs.
- `expires_at` is nullable: `NULL` means the link never expires.

`scripts/migrate.ts`
```ts
import { readdir, readFile } from 'node:fs/promises';
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name       TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);

const { rows } = await client.query<{ name: string }>('SELECT name FROM schema_migrations');
const applied = new Set(rows.map((r) => r.name));

const dir = new URL('../migrations/', import.meta.url);
const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

for (const file of files) {
  if (applied.has(file)) continue;

  const sql = await readFile(new URL(file, dir), 'utf8');
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    await client.query('COMMIT');
    console.log(`applied ${file}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

console.log('migrations up to date');
await client.end();
```
- Files are sorted by name, which is why they're numbered `001_`, `002_`, ...
- Each migration runs in a **transaction** together with its bookkeeping insert. Either both happen or neither does: a half-applied migration can't exist. (Postgres can roll back DDL like `CREATE TABLE`, which many databases can't.)
- `import.meta.url` is the ESM replacement for `__dirname`.

### Check
```bash
npm run migrate          # applied 001_create_links.sql
npm run migrate          # just "migrations up to date": it's idempotent
docker compose exec postgres psql -U axl -c '\d links'
```

---

## Step 3 — Short code generator

### What & why
**Base62** = `0-9a-zA-Z`: 62 characters that are all URL-safe. With 7 characters:

```
62^7 = 3,521,614,606,208  (~3.5 trillion codes)
```

We pick characters **randomly** instead of counting up (1, 2, 3 → base62), because sequential
codes let anyone enumerate every link you've shortened by guessing `aaaaaab`, `aaaaaac`, ...

**How likely is a collision?** At 10M stored links, a new random code hits an existing one with
probability 10M / 3.5T ≈ 1 in 350,000. Rare, but it *will* happen eventually, so step 6 handles it.

### Code

`src/lib/shortCode.ts`
```ts
import { randomInt } from 'node:crypto';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const CODE_LENGTH = 7;

export function generateCode(length = CODE_LENGTH): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}
```
- `crypto.randomInt` instead of `Math.random()`:
  - `Math.random` is predictable, not cryptographically secure.
  - The classic `bytes[i] % 62` trick is **biased**: 256 isn't divisible by 62, so the first few characters show up more often.
  - `randomInt` is secure *and* uniform.

`test/shortCode.test.ts`
```ts
import { describe, expect, it } from 'vitest';
import { CODE_LENGTH, generateCode } from '../src/lib/shortCode.js';

describe('generateCode', () => {
  it('returns a code of the default length', () => {
    expect(generateCode()).toHaveLength(CODE_LENGTH);
  });

  it('only uses base62 characters', () => {
    for (let i = 0; i < 1000; i++) {
      expect(generateCode()).toMatch(/^[0-9a-zA-Z]+$/);
    }
  });

  it('does not repeat itself in practice', () => {
    const codes = new Set(Array.from({ length: 10_000 }, () => generateCode()));
    expect(codes.size).toBe(10_000);
  });
});
```

### Check
```bash
npm test
```

---

## Step 4 — Validating the target URL

### What & why
**Never trust user input.** A shortener turns *anyone's* URL into a link that looks
trustworthy, so it's an attack surface:
- `javascript:alert(document.cookie)`: if a browser ever follows that, it runs code.
- `file:///etc/passwd`, `data:...`: nothing legitimate needs these.
- `http://localhost:3000/abc`, i.e. a link to *ourselves*. Shorten a short link a few times and you can build redirect loops.

The URL gets parsed with the built-in `URL` class. Hand-rolled regexes for URLs are always wrong somewhere.

We return a **discriminated union** instead of throwing. The caller *has* to check `ok`, and
TypeScript then knows which fields exist. It's the "errors as values" style, great for *expected* failures.

### Code

`src/lib/targetUrl.ts`
```ts
export type ParseResult = { ok: true; url: string } | { ok: false; error: string };

export function parseTargetUrl(input: string, ownHost: string): ParseResult {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, error: 'Not a valid URL' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: 'Only http and https URLs are allowed' };
  }
  if (url.hostname === ownHost) {
    return { ok: false, error: 'Cannot shorten a link that points to this service' };
  }

  return { ok: true, url: url.toString() };
}
```
- `url.toString()` **normalizes** the URL (for example, it lowercases the host), so what gets stored is clean.

`test/targetUrl.test.ts`
```ts
import { describe, expect, it } from 'vitest';
import { parseTargetUrl } from '../src/lib/targetUrl.js';

const OWN_HOST = 'localhost';

describe('parseTargetUrl', () => {
  it('accepts http and https URLs', () => {
    expect(parseTargetUrl('https://example.com/a?b=1', OWN_HOST)).toEqual({
      ok: true,
      url: 'https://example.com/a?b=1',
    });
    expect(parseTargetUrl('http://example.com', OWN_HOST).ok).toBe(true);
  });

  it('rejects garbage', () => {
    expect(parseTargetUrl('not a url', OWN_HOST).ok).toBe(false);
  });

  it('rejects dangerous schemes', () => {
    expect(parseTargetUrl('javascript:alert(1)', OWN_HOST).ok).toBe(false);
    expect(parseTargetUrl('file:///etc/passwd', OWN_HOST).ok).toBe(false);
  });

  it('rejects links back to ourselves', () => {
    expect(parseTargetUrl('http://localhost:3000/abc', OWN_HOST).ok).toBe(false);
  });
});
```

### Check
`npm test`. That's 7 tests passing now.

---

## Step 5 — Repository (the only place SQL lives)

### What & why
The **repository pattern** hides the database behind plain methods like `insert` and `findByCode`.
The rest of the app never sees SQL or column names.

It also converts **DB shape → app shape**: Postgres uses `snake_case`, TypeScript uses `camelCase`.

### Code

`src/links/linkRepository.ts`
```ts
import type { Pool } from 'pg';

export interface Link {
  id: string;
  code: string;
  longUrl: string;
  createdAt: Date;
  expiresAt: Date | null;
  clickCount: number;
}

interface LinkRow {
  id: string;
  code: string;
  long_url: string;
  created_at: Date;
  expires_at: Date | null;
  click_count: string;
}

function toLink(row: LinkRow): Link {
  return {
    id: row.id,
    code: row.code,
    longUrl: row.long_url,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    clickCount: Number(row.click_count),
  };
}

export class LinkRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: { code: string; longUrl: string; expiresAt: Date | null }): Promise<Link> {
    const { rows } = await this.pool.query<LinkRow>(
      `INSERT INTO links (code, long_url, expires_at)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [input.code, input.longUrl, input.expiresAt],
    );
    return toLink(rows[0]);
  }

  async findByCode(code: string): Promise<Link | null> {
    const { rows } = await this.pool.query<LinkRow>('SELECT * FROM links WHERE code = $1', [code]);
    return rows[0] ? toLink(rows[0]) : null;
  }

  async incrementClicks(code: string, by: number): Promise<void> {
    await this.pool.query('UPDATE links SET click_count = click_count + $2 WHERE code = $1', [
      code,
      by,
    ]);
  }
}
```
Things to notice:
- **`$1, $2` placeholders**, never string concatenation. The driver sends values separately from
  the SQL, which makes **SQL injection** impossible. `` `WHERE code = '${code}'` `` would be a vulnerability.
- **Why are `id` and `click_count` typed as `string`?** Postgres `BIGINT` goes up to 2^63, but JS numbers
  are only exact to 2^53. `pg` returns them as strings to stay safe. We convert `click_count` with
  `Number()` (it'll never pass 2^53) and keep `id` as a string.
- `RETURNING *` gives back the inserted row (with `id` and `created_at` filled in) in the same round trip.
- **Pool vs Client:** opening a Postgres connection is slow (TCP + auth). A **pool** keeps a set of open
  connections and lends them out per query.
- `constructor(private readonly pool: Pool)` is TS shorthand that declares *and* assigns `this.pool`.
  We **pass the pool in** instead of importing a global one. That's **dependency injection**, and it's why this is testable.

---

## Step 6 — Service: create + resolve (with a cache)

### What & why
This is the brain. Two operations:

**create:** the code is generated randomly, and the insert is attempted directly. If Postgres says "unique violation"
(error code `23505`), we try another code, up to 5 attempts. This is **optimistic concurrency**:
we don't check first, we just try and let the database be the referee. A "check then insert"
approach has a race: two requests both check, both see it's free, both insert.

**resolve:** this is the **hot path**. Remember the ~100:1 read/write ratio. We use the
**cache-aside** pattern:
```
1. look in Redis ── hit ──► return it (sub-millisecond, no DB touched)
2. miss → query Postgres
3. write the answer into Redis with a TTL
4. return it
```
Two subtleties handled here:
- **Negative caching:** if a code *doesn't* exist, we cache that too (for 60s). Otherwise
  a bot hammering random codes sends every request straight to Postgres.
- **Expiry + TTL:** if a link expires in 5 minutes, caching it for 24h would keep it alive
  past its expiry. So `TTL = min(24h, time until expiry)`.
- **Invalidation:** after creating a link we `DEL` its cache key, in case "not found" was cached for that
  code a moment earlier (for example, someone tried `/launch` right before you created the alias `launch`).

> "There are only two hard things in Computer Science: cache invalidation and naming things."
> You just did the first one.

### Code

`src/links/linkService.ts`
```ts
import type { Redis } from 'ioredis';
import { generateCode } from '../lib/shortCode.js';
import type { Link, LinkRepository } from './linkRepository.js';

const UNIQUE_VIOLATION = '23505';
const MAX_ATTEMPTS = 5;
const CACHE_TTL_SECONDS = 60 * 60 * 24;
const NEGATIVE_TTL_SECONDS = 60;
const NOT_FOUND = '__none__';

export class AliasTakenError extends Error {}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === UNIQUE_VIOLATION;
}

export class LinkService {
  constructor(
    private readonly repo: LinkRepository,
    private readonly redis: Redis,
  ) {}

  async create(input: { longUrl: string; alias?: string; expiresAt?: Date }): Promise<Link> {
    const expiresAt = input.expiresAt ?? null;

    if (input.alias) {
      try {
        const link = await this.repo.insert({ code: input.alias, longUrl: input.longUrl, expiresAt });
        await this.redis.del(`link:${link.code}`);
        return link;
      } catch (err) {
        if (isUniqueViolation(err)) throw new AliasTakenError(`Alias "${input.alias}" is taken`);
        throw err;
      }
    }

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const link = await this.repo.insert({ code: generateCode(), longUrl: input.longUrl, expiresAt });
        await this.redis.del(`link:${link.code}`);
        return link;
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
      }
    }
    throw new Error(`Could not generate a unique code after ${MAX_ATTEMPTS} attempts`);
  }

  async resolve(code: string): Promise<string | null> {
    const key = `link:${code}`;

    const cached = await this.redis.get(key);
    if (cached !== null) return cached === NOT_FOUND ? null : cached;

    const link = await this.repo.findByCode(code);
    if (!link || (link.expiresAt && link.expiresAt <= new Date())) {
      await this.redis.set(key, NOT_FOUND, 'EX', NEGATIVE_TTL_SECONDS);
      return null;
    }

    let ttl = CACHE_TTL_SECONDS;
    if (link.expiresAt) {
      const secondsLeft = Math.ceil((link.expiresAt.getTime() - Date.now()) / 1000);
      ttl = Math.min(ttl, secondsLeft);
    }
    await this.redis.set(key, link.longUrl, 'EX', ttl);
    return link.longUrl;
  }

  async recordClick(code: string): Promise<void> {
    await this.redis.incr(`clicks:${code}`);
  }
}
```
- For a **custom alias**, a collision isn't bad luck. It means someone already has it, so we throw a
  *specific* error type the route can turn into `409 Conflict`. Retrying would silently give the
  user a different code than the one they asked for.
- `err: unknown`: in TS, caught errors are `unknown` because JS lets you `throw` anything.
  `isUniqueViolation` narrows it safely.
- Redis keys are namespaced (`link:…`, `clicks:…`). That's a convention that keeps one Redis usable for many features.
- `recordClick` is used in step 8. It's here now so the service is complete.

---

## Step 7 — Routes: the HTTP layer (first working version!)

### What & why
Routes translate HTTP ↔ service calls. Their jobs: **validate input → call the service → pick a status code.**

**302 vs 301** (a classic interview question):
- `301 Moved Permanently`: browsers **cache it forever**. The second click never reaches us, so we lose analytics and can never change or expire the link.
- `302 Found`: browsers ask us every time. We pick **302**.

Why check `CODE_PATTERN` before touching Redis at all? Junk requests like
`/wp-admin.php` or `/favicon.ico` get rejected for free.

Fastify **plugins** (`FastifyPluginAsync`) are how you group routes, and they receive options.
That's how the route gets the `service` without importing a global.

### Code

`src/links/linkRoutes.ts`
```ts
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { parseTargetUrl } from '../lib/targetUrl.js';
import { AliasTakenError, type LinkService } from './linkService.js';

const CODE_PATTERN = /^[A-Za-z0-9_-]{3,32}$/;
const RESERVED = new Set(['api', 'health', 'admin', 'static']);

const CreateLinkBody = z.object({
  url: z.string().max(2048),
  alias: z.string().regex(CODE_PATTERN, '3-32 chars: letters, digits, _ or -').optional(),
  expiresAt: z.coerce.date().optional(),
});

interface LinkRoutesOptions {
  service: LinkService;
  baseUrl: string;
}

export const linkRoutes: FastifyPluginAsync<LinkRoutesOptions> = async (app, { service, baseUrl }) => {
  const ownHost = new URL(baseUrl).hostname;

  app.post('/api/links', async (request, reply) => {
    const parsed = CreateLinkBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', issues: parsed.error.issues });
    }
    const { url, alias, expiresAt } = parsed.data;

    if (alias && RESERVED.has(alias.toLowerCase())) {
      return reply.code(400).send({ error: `"${alias}" is reserved` });
    }
    if (expiresAt && expiresAt <= new Date()) {
      return reply.code(400).send({ error: 'expiresAt must be in the future' });
    }

    const target = parseTargetUrl(url, ownHost);
    if (!target.ok) {
      return reply.code(400).send({ error: target.error });
    }

    try {
      const link = await service.create({ longUrl: target.url, alias, expiresAt });
      return reply.code(201).send({
        code: link.code,
        shortUrl: `${baseUrl}/${link.code}`,
        longUrl: link.longUrl,
        expiresAt: link.expiresAt,
      });
    } catch (err) {
      if (err instanceof AliasTakenError) return reply.code(409).send({ error: err.message });
      throw err;
    }
  });

  app.get<{ Params: { code: string } }>('/:code', async (request, reply) => {
    const { code } = request.params;
    if (!CODE_PATTERN.test(code)) return reply.code(404).send({ error: 'Not found' });

    const longUrl = await service.resolve(code);
    if (!longUrl) return reply.code(404).send({ error: 'Not found' });

    return reply.redirect(longUrl, 302);
  });
};
```
- `safeParse` returns `{ success, data | error }` instead of throwing. Bad input is *expected*, not exceptional.
- **Status codes:** `201 Created` for a new resource, `400` for your fault, `409 Conflict` for "that name's taken", `404` for "no such link".
  Anything else we **re-throw**, and Fastify turns it into a `500` and logs it. Don't swallow unknown errors.
- **Reserved words:** if someone grabs the alias `api`, it'd shadow `/api/...` routes, so we block those.
- `app.get<{ Params: ... }>` tells TypeScript the shape of `request.params`.
- Why don't `/health` and `/:code` fight? Fastify's router always prefers **static** paths over **parametric** ones.

Now wire everything together. Replace `src/app.ts`:
```ts
import Fastify from 'fastify';
import type { Redis } from 'ioredis';
import type { Pool } from 'pg';
import { LinkRepository } from './links/linkRepository.js';
import { linkRoutes } from './links/linkRoutes.js';
import { LinkService } from './links/linkService.js';

export interface AppDeps {
  pool: Pool;
  redis: Redis;
  baseUrl: string;
  logger?: boolean;
}

export function buildApp(deps: AppDeps) {
  const app = Fastify({ logger: deps.logger ?? true });
  const service = new LinkService(new LinkRepository(deps.pool), deps.redis);

  app.get('/health', async () => ({ status: 'ok' }));
  app.register(linkRoutes, { service, baseUrl: deps.baseUrl });

  return app;
}
```
and `src/server.ts`:
```ts
import { Redis } from 'ioredis';
import pg from 'pg';
import { buildApp } from './app.js';
import { config } from './config.js';

const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 10 });
const redis = new Redis(config.REDIS_URL);

const app = buildApp({ pool, redis, baseUrl: config.BASE_URL });
await app.listen({ port: config.PORT, host: '0.0.0.0' });
```
Look at the shape: `server.ts` creates the **real** connections and *injects* them. `buildApp`
wires repository → service → routes. In tests, you'll inject test connections instead.

### Check (the big one 🎉)
```bash
npm run dev

# create
curl -X POST http://localhost:3000/api/links \
  -H "Content-Type: application/json" \
  -d '{"url":"https://github.com"}'
# → {"code":"aB3xK9q","shortUrl":"http://localhost:3000/aB3xK9q",...}

# follow it (-i shows headers: look for "302" and "location:")
curl -i http://localhost:3000/aB3xK9q

# custom alias, then the same alias again → 409
curl -X POST http://localhost:3000/api/links -H "Content-Type: application/json" -d '{"url":"https://github.com","alias":"gh"}'
curl -X POST http://localhost:3000/api/links -H "Content-Type: application/json" -d '{"url":"https://github.com","alias":"gh"}'

# bad input → 400
curl -X POST http://localhost:3000/api/links -H "Content-Type: application/json" -d '{"url":"javascript:alert(1)"}'
```
Open the short URL in your browser too. **Watch the cache work:**
```bash
docker compose exec redis redis-cli KEYS 'link:*'
docker compose exec redis redis-cli TTL link:gh     # seconds left, counting down from 86400
```

---

## Step 8 — Click counting without slowing redirects

### What & why
The naive version runs `UPDATE links SET click_count = click_count + 1` on every redirect. Problems:
1. It adds a DB write to the hot path, so redirects get slower.
2. A viral link means thousands of writes per second to the **same row**. Row locks turn it into a queue.

**Better: buffer, then batch.**
- On redirect: `INCR clicks:<code>` in Redis. It's atomic, in-memory, and around 0.1ms. We **don't even await it**.
- Every 10s, a background job moves the counts into Postgres: 1 viral link × 10,000 clicks becomes **one** `UPDATE ... + 10000`.

This is **write-behind** / **batching**, the same idea real analytics pipelines use (at scale
you'd send events to Kafka instead).

**Trade-off to understand:** `GETDEL` reads and deletes the counter atomically. If the
Postgres update then fails, those clicks are lost. That makes it **at-most-once** delivery, which is fine
for click stats but *not* fine for money. Fixing it properly (at-least-once + idempotency) is a
great exercise for later.

`SCAN` vs `KEYS`: `KEYS clicks:*` blocks Redis while it walks **every** key. `SCAN` walks
in small batches with a cursor and never blocks. Never use `KEYS` in production code.

### Code

`src/links/clickFlusher.ts`
```ts
import type { FastifyBaseLogger } from 'fastify';
import type { Redis } from 'ioredis';
import type { LinkRepository } from './linkRepository.js';

const PREFIX = 'clicks:';

export async function flushClicks(redis: Redis, repo: LinkRepository): Promise<void> {
  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', `${PREFIX}*`, 'COUNT', 100);
    cursor = next;

    for (const key of keys) {
      const count = await redis.getdel(key);
      if (count) await repo.incrementClicks(key.slice(PREFIX.length), Number(count));
    }
  } while (cursor !== '0');
}

export function startClickFlusher(
  redis: Redis,
  repo: LinkRepository,
  log: FastifyBaseLogger,
  intervalMs = 10_000,
): () => void {
  let running = false;

  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await flushClicks(redis, repo);
    } catch (err) {
      log.error({ err }, 'click flush failed');
    } finally {
      running = false;
    }
  }, intervalMs);

  return () => clearInterval(timer);
}
```
- The `running` flag stops a slow flush from overlapping with the next tick.
- It returns a `stop` function, which is a neat pattern for anything you start and must later clean up.

In `linkRoutes.ts`, record the click just before the redirect:
```ts
    service.recordClick(code).catch((err) => request.log.warn({ err }, 'failed to record click'));
    return reply.redirect(longUrl, 302);
```
We deliberately **don't `await`**: the user gets redirected right away. The `.catch` is
mandatory, because an unhandled rejected promise crashes Node. And analytics must **never** break a redirect.

Update `src/server.ts`. Start the flusher, and add a **graceful shutdown**:
```ts
import { Redis } from 'ioredis';
import pg from 'pg';
import { buildApp } from './app.js';
import { config } from './config.js';
import { startClickFlusher } from './links/clickFlusher.js';
import { LinkRepository } from './links/linkRepository.js';

const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 10 });
const redis = new Redis(config.REDIS_URL);

const app = buildApp({ pool, redis, baseUrl: config.BASE_URL });
const stopFlusher = startClickFlusher(redis, new LinkRepository(pool), app.log);

async function shutdown(signal: string) {
  app.log.info(`${signal} received, shutting down`);
  stopFlusher();
  await app.close();
  await pool.end();
  redis.disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: config.PORT, host: '0.0.0.0' });
```
Graceful shutdown: when Docker/Kubernetes stops you (it sends `SIGTERM`), stop accepting new
requests, let in-flight ones finish (`app.close()`), close connections, *then* exit.

### Check
Hit a short link a few times, then:
```bash
docker compose exec redis redis-cli GET clicks:gh           # e.g. "3"
# wait ~10 seconds
docker compose exec postgres psql -U axl -c "SELECT code, click_count FROM links"
```

---

## Step 9 — Rate limiting

### What & why
Without a limit, one script can create millions of links (spam, or filling your DB). We cap
**creation** at 10/minute per IP. Redirects stay unlimited. They're cheap, and a limit there would break
legitimate viral links.

The limiter stores counters **in Redis**, not in process memory. With 3 servers behind a load
balancer, in-memory limits would allow 3× the rate. Shared state has to live in a shared store.

### Code
In `src/app.ts`, add the import and register the plugin before the routes:
```ts
import rateLimit from '@fastify/rate-limit';
// ...
  app.register(rateLimit, { global: false, redis: deps.redis });
```
`global: false` means "only routes that opt in". Then in `linkRoutes.ts`, opt the POST route in by
passing a route options object as the second argument:
```ts
  app.post(
    '/api/links',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      // ... same handler body as before
    },
  );
```

### Check
Run the create `curl` 11 times quickly. The 11th returns `429 Too Many Requests`, with
`x-ratelimit-*` headers telling the client when to retry.

> Behind a reverse proxy or load balancer, every request appears to come from the proxy's IP.
> You'd set Fastify's `trustProxy: true` so it reads `X-Forwarded-For`. Only do that when you really are behind a proxy you trust.

---

## Step 10 — Integration tests

### What & why
Unit tests (steps 3–4) test pure functions. **Integration tests** exercise the real stack: HTTP →
service → real Redis → real Postgres. This is where `buildApp()` pays off: `app.inject()`
fakes an HTTP request **in memory**, with no port, no network, and it's fast.

### Code

`test/links.test.ts`
```ts
import { Redis } from 'ioredis';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://axl:axl@localhost:5433/axl',
});
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
const app = buildApp({ pool, redis, baseUrl: 'http://localhost:3000', logger: false });

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await pool.end();
  redis.disconnect();
});

describe('links API', () => {
  it('creates a link and redirects to it', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: { url: 'https://example.com/hello' },
    });
    expect(create.statusCode).toBe(201);
    const { code } = create.json();

    const redirect = await app.inject({ method: 'GET', url: `/${code}` });
    expect(redirect.statusCode).toBe(302);
    expect(redirect.headers.location).toBe('https://example.com/hello');
  });

  it('rejects an invalid URL', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/links', payload: { url: 'nope' } });
    expect(res.statusCode).toBe(400);
  });

  it('returns 409 when an alias is taken', async () => {
    const alias = `test-${Date.now()}`;
    const first = await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: { url: 'https://example.com', alias },
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: { url: 'https://example.com', alias },
    });
    expect(second.statusCode).toBe(409);
  });

  it('returns 404 for unknown codes', async () => {
    const res = await app.inject({ method: 'GET', url: '/doesNotExist1' });
    expect(res.statusCode).toBe(404);
  });
});
```
- `Date.now()` in the alias keeps test runs from colliding with each other's leftover data.
  (The more rigorous approach is a separate test database that gets truncated between runs. Try that as an exercise.)
- Needs `docker compose up -d` and `npm run migrate` first.

### Check
`npm test`: all green. `npm run typecheck`: no errors.

---

## Step 11 — A tiny frontend

### What & why
One HTML file with a form that calls your own API: no framework, no build step.
The server reads it **once at startup** (not per request) and serves it at `/`.

> Why not `@fastify/static`? It registers a wildcard route `/*`, and our `/:code` route would
> swallow its requests. For one file, a plain route is simpler.

### Code

`public/index.html`
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>axl</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 560px; margin: 4rem auto; padding: 0 1rem; }
    form { display: flex; gap: .5rem; }
    input { flex: 1; padding: .6rem; font-size: 1rem; }
    button { padding: .6rem 1rem; font-size: 1rem; cursor: pointer; }
    #result { margin-top: 1.5rem; }
    .error { color: #c0392b; }
  </style>
</head>
<body>
  <h1>axl</h1>
  <form id="form">
    <input id="url" type="url" placeholder="https://example.com/some/long/path" required />
    <button type="submit">Shorten</button>
  </form>
  <div id="result"></div>

  <script>
    const form = document.getElementById('form');
    const result = document.getElementById('result');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      result.textContent = '';
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: document.getElementById('url').value }),
      });
      const data = await res.json();

      if (!res.ok) {
        const p = document.createElement('p');
        p.className = 'error';
        p.textContent = data.error ?? 'Something went wrong';
        result.append(p);
        return;
      }

      const link = document.createElement('a');
      link.href = data.shortUrl;
      link.textContent = data.shortUrl;
      const copy = document.createElement('button');
      copy.textContent = 'Copy';
      copy.onclick = () => navigator.clipboard.writeText(data.shortUrl);
      result.append(link, ' ', copy);
    });
  </script>
</body>
</html>
```
- We use `textContent`, **never** `innerHTML`, with server data. If an error message ever
  contained `<script>`, `innerHTML` would execute it (XSS). `textContent` treats it as plain text.

In `src/app.ts`, add:
```ts
import { readFileSync } from 'node:fs';
// ...
const indexHtml = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

// inside buildApp, next to /health:
  app.get('/', async (_request, reply) => reply.type('text/html').send(indexHtml));
```

### Check
Open http://localhost:3000, shorten something, and click the result.

---

## You're done with the MVP 🎉 What next?

Each of these teaches a real system-design concept. Roughly in order of difficulty:

1. **`GET /api/links/:code/stats`**: return click count and created date. Easy warm-up.
2. **Dedupe:** the same long URL returns the existing code? (Think: is that what users want? Add an index on `long_url`, or better, on a hash of it.)
3. **Test database:** a separate `axl_test` DB that gets truncated before each test run.
4. **Dockerize the app itself:** a `Dockerfile` (multi-stage: build with `tsc`, run `dist/`), then add it to compose.
5. **Load test** with [`autocannon`](https://github.com/mcollina/autocannon): `npx autocannon http://localhost:3000/gh`.
   Compare req/s with Redis on vs. off. You'll *see* why the cache matters.
6. **Detailed analytics:** a `clicks` table (timestamp, referrer, country, user agent). Then ask
   what happens at 10k clicks/sec, and look at Redis Streams or Kafka.
7. **Accounts + API keys**: users own links and can list or delete them. (Deleting means invalidating the cache!)
8. **Scale the ID generation:** replace random + retry with a Snowflake-style ID or pre-allocated
   ID ranges per server. It's the classic system-design interview follow-up.
9. **Malicious URL checking** with the Google Safe Browsing API, done asynchronously after creation.

When you're stuck on any step: re-read the "What & why", check `npm run typecheck`, and read the
Fastify logs. They're more helpful than they look.
