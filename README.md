# axl

**Advanced eXpress Links**: a URL shortener by ARX Studios, served at `axl.arxstudios.pro/<code>`.

Next.js 16 (App Router) · Postgres (Supabase) · Redis/Valkey (Render) · Supabase Auth · Vercel

## How it works

```
Browser ── axl.arxstudios.pro ──► Next.js on Vercel
                                   ├─ /                 home, sign-in (ARX Studios account)
                                   ├─ /dashboard        create, list, copy, delete links
                                   ├─ /api/links[...]   JSON API (sign-in required)
                                   └─ /<code>           302 redirect ──► Redis cache ──► Postgres
```

- **Redirects** read from Redis first (cache-aside, 24h TTL, negative caching for unknown codes) and only fall back to Postgres on a miss.
- **Clicks** are counted with `INCR` in Redis after the redirect has been sent (`after()`), then flushed to Postgres in batches. The request that wins a 10-second lock does the flush.
- **Sign-in** uses the ARX Studios Supabase project (Google or email link). The server verifies the session JWT locally with the project's public keys.
- **Links belong to users.** Shortening the same URL twice returns the same code. Deleted links are soft-deleted, so their codes are never reused.
- **Rate limit:** 10 new links per minute per user (Redis fixed window).

## Project layout

```
app/            pages and route handlers: api/ (JSON API), [code]/ (redirects)
proxy.ts        refreshes the sign-in session (skips short-link redirects)
components/     UI (shader, cinematic footer, sign-in form, modal)
lib/            shared helpers (short codes, URL validation, formatting, Supabase clients)
server/         server-only code: env, db, redis, auth, rate limit, links/ (repository + service)
migrations/     SQL migrations, applied by scripts/migrate.mts
test/           vitest (integration tests run against docker compose)
```

## Local development

Requires Node 24+ and Docker Desktop.

```bash
cp .env.example .env        # then fill in the two NEXT_PUBLIC_SUPABASE_* values
docker compose up -d        # Postgres on :5433, Redis on :6379
docker compose exec postgres createdb -U axl axl_dev
npm install
npm run migrate
npm run dev                 # http://localhost:3000
```

Sign-in redirects back to `http://localhost:3000/auth/callback`, which must be listed under
Authentication → URL Configuration → Redirect URLs in the ARX Studios Supabase project.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build and serve |
| `npm test` | Run tests (needs `docker compose up`) |
| `npm run typecheck` | Type-check |
| `npm run lint` | ESLint |
| `npm run migrate` | Apply pending SQL migrations to `DATABASE_URL` |

## API

All `/api/links` routes require a signed-in session (cookie).

| Method | Path | Result |
|---|---|---|
| `POST` | `/api/links` | `{ url, alias?, expiresAt? }` → `201` created, `200` if you already shortened that URL |
| `GET` | `/api/links?cursor=` | Your links, newest first, 20 per page, `nextCursor` for the next page |
| `GET` | `/api/links/:code` | One of your links, with its click count |
| `DELETE` | `/api/links/:code` | `204`; the short link stops working immediately |
| `GET` | `/api/me` | The signed-in user |
| `GET` | `/:code` | `302` to the destination, or `404` |

`docs/GUIDE.md` is the step-by-step guide for the original Fastify version of this project.
