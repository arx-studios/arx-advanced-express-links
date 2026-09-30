# 9. Local development

## Prerequisites

- Node.js 24+ (developed on Node 26)
- Docker Desktop (for local Postgres and Redis)
- Access to the ARX Studios Supabase project's URL and publishable key (for sign-in)

## First-time setup

```bash
cp .env.example .env          # fill in the two NEXT_PUBLIC_SUPABASE_* values
docker compose up -d          # Postgres on :5433, Redis on :6379
docker compose exec postgres createdb -U axl axl_dev
npm install
npm run migrate               # applies migrations to axl_dev
npm run dev                   # http://localhost:3000
```

Local Postgres is on **port 5433**, because the development machine already had
another Postgres on 5432. Credentials are `axl` / `axl` (local only).

Sign-in works locally because `http://localhost:3000/auth/callback` is on the auth
project's Redirect URLs list.

`.env` for local development:

```
BASE_URL=http://localhost:3000
DATABASE_URL=postgres://axl:axl@localhost:5433/axl_dev
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_SUPABASE_URL=https://<auth-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server with hot reload |
| `npm run build` / `npm start` | Production build, then serve it |
| `npm test` | All tests (needs `docker compose up`) |
| `npm run test:watch` | Tests in watch mode |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Next.js config) |
| `npm run migrate` | Apply migrations to the local database |
| `npm run migrate:prod` | Apply migrations to Supabase (needs `.env.supabase` and `certs/`) |

## Tests

40 tests in 7 files, run with Vitest against the real local Postgres (`axl_dev`) and
Redis (database 1, flushed at the start).

| File | Covers |
|---|---|
| `test/links.test.ts` | The whole API through the route handlers: auth (401s), create, per-user dedupe, concurrent creates, aliases, validation, listing and pagination, ownership, click counting, delete (cache invalidation, no code reuse), the HTML/JSON 404 |
| `test/resilience.test.ts` | Redis down (commands fail) and Redis hanging (never answers): links still work from Postgres, within time limits; the rate limiter fails open; `connectionConfig` TLS handling |
| `test/keepalive.test.ts` | Secret check, both Supabase pings (auth project faked), click flush, failure reporting, step timings |
| `test/rateLimit.test.ts` | Fixed window, TTL always set, client IP parsing |
| `test/shortCode.test.ts` | Code length, alphabet, uniqueness in practice |
| `test/targetUrl.test.ts` | Accepted and rejected URLs |
| `test/format.test.ts` | Relative times, expiry, display URLs |

How the tests handle Next.js and auth:
- **Route handlers are called directly** as functions with `new Request(…)`; there's no
  server to start.
- **`after()`** only works inside a real Next request, so tests replace it with a
  version that collects the tasks, and then await them.
- **Sign-in** is replaced by a mock of `@/server/auth` that returns whichever fake user
  the test "signs in".
- **`server-only`** throws outside Next's server bundle, so Vitest aliases it to an empty
  stub.
- Test files run **one after another** (`fileParallelism: false`): they share one
  database and one Redis, and some flush it.

## Conventions

- **Layers:** routes (HTTP) → service (rules) → repositories (SQL). Keep SQL out of routes
  and HTTP out of the service. See [Architecture](02-architecture.md#code-layering).
- **Server-only code** goes in `server/` and imports `'server-only'`. Shared,
  framework-free helpers go in `lib/`.
- **Environment variables** are declared in `server/env.ts` (zod) and read with `env()`.
- **Redis calls on request paths** must be bounded with `withTimeout()`. Never add a
  client-wide `commandTimeout` (see [System design](03-system-design.md#redis-connection-and-timeouts)).
- **Schema changes** go in a new numbered migration file.
- **Comments** explain *why*, not *what*.
- Source files use **CRLF** line endings (Windows); Git shows harmless
  "LF will be replaced by CRLF" warnings.

## Windows / PowerShell notes

- In Windows PowerShell 5.1, `curl` is an alias for `Invoke-WebRequest`. Use
  `curl.exe`, or `Invoke-RestMethod`:
  ```powershell
  Invoke-RestMethod http://localhost:3000/api/health
  ```
- PowerShell strips inner double quotes when calling native programs, so JSON bodies
  for `curl.exe` need escaping (`'{\"url\":\"https://example.com\"}'`).
- The dev server keeps its database and Redis connections for the life of the process.
  After changing `DATABASE_URL`, `REDIS_URL` or connection settings, **restart**
  `npm run dev`.
- The VS Code TypeScript server can show stale "cannot find module" errors after files
  move; run **TypeScript: Restart TS Server**. `npm run typecheck` is the source of truth.

## Checking the UI without signing in

Headless browsers can't complete Google sign-in. To screenshot the dashboard, the
dashboard's layout is a separate component (`app/dashboard/dashboard-shell.tsx`) that
can be rendered with fake links on a temporary page. That page was deleted before
committing and must never be committed.
