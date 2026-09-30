# 1. Overview

## What axl is

axl turns long URLs into short ones on the ARX Studios domain:

```
https://example.com/campaigns/october?utm_source=twitter&utm_medium=social
        ↓
https://axl.arxstudios.pro/promo-oct
```

The name stands for **Advanced eXpress Links**, and the home page spells it out with
the **A**, **X** and **L** highlighted.

## Features

| Feature | Details |
|---|---|
| Sign in | With the same ARX Studios account as arxstudios.pro: Google, or an emailed magic link |
| Shorten | Paste a URL, get `axl.arxstudios.pro/<code>` with a random 7-character code |
| Custom alias | Choose your own code (3–32 letters, digits, `_` or `-`) |
| Expiry | Optional date/time after which the link stops working |
| Dedupe | Shortening the same URL twice returns your existing link instead of a new one |
| Dashboard | Your links, newest first: click counts, age, expiry badges, copy, delete, load more |
| Click counting | Every redirect is counted; counts shown live, including clicks not yet saved to the database |
| Delete | Stops the link immediately; the code is never reused by anyone |
| Branded 404 | Unknown, expired or deleted links show an "Link not found" page |
| Public redirects | Anyone can open a short link; no account needed |

Who can do what:

| | Visitor | Signed-in user |
|---|---|---|
| Open a short link | ✅ | ✅ |
| Create, list, delete links | ❌ | ✅ (own links only) |
| See someone else's links | ❌ | ❌ |

## Tech stack

| Layer | Technology | Hosted on |
|---|---|---|
| App (UI + API + redirects) | Next.js 16 (App Router), React 19, TypeScript | Vercel, functions in Singapore (`sin1`) |
| Styling | Tailwind CSS v4, shadcn setup, framer-motion, GSAP, three.js shader | (part of the app) |
| Database | PostgreSQL | Supabase project **arxExpressLinks** (`ap-southeast-1`, Singapore) |
| Cache / counters | Valkey 8 (Redis-compatible) | Render Key Value **axl-cache** (Singapore) |
| Sign-in | Supabase Auth (Google OAuth, magic link) | Supabase project **arxstudios's Project** (shared with arxstudios.pro) |
| DNS | `axl` CNAME → Vercel | Hostinger (`arxstudios.pro`) |
| Scheduled jobs | Vercel Cron | Vercel |
| Tests | Vitest | local, against Docker |

Server-side libraries: `pg` (Postgres), `ioredis` (Redis), `zod` (validation),
`@supabase/ssr` (sessions), `@vercel/functions` (connection pool lifecycle).

## Repository layout

```
app/                         Next.js App Router
  page.tsx                   home (hero, features, cinematic footer)
  signin/  privacy/          sign-in and privacy pages
  dashboard/                 the app: shorten form, link list (client components)
  auth/callback/route.ts     finishes sign-in, sets the session cookie
  [code]/route.ts            the redirect: /<code> → 302
  api/links/route.ts         POST create, GET list
  api/links/[code]/route.ts  GET details, DELETE
  api/me/route.ts            the signed-in user
  api/health/route.ts        liveness check
  api/cron/keepalive/        daily keep-alive job
proxy.ts                     refreshes the sign-in session (Next 16 "proxy" = middleware)
components/                  UI: sign-in form, modal, footers, shader background
lib/                         shared, framework-free helpers
  shortCode.ts  targetUrl.ts  codes.ts  format.ts  timeout.ts  pgConnection.ts
  supabase/                  Supabase clients for browser, server and proxy
server/                      server-only code (never shipped to the browser)
  env.ts  db.ts  redis.ts  auth.ts  rateLimit.ts  linkNotFoundPage.ts
  links/                     linkRepository (SQL), linkService (rules), clickFlush, linkJson
  users/userRepository.ts
migrations/001_init.sql      the database schema
scripts/migrate.mts          migration runner
test/                        Vitest tests (run against Docker Postgres + Redis)
vercel.json                  region pin (sin1) and the cron schedule
docker-compose.yml           local Postgres (port 5433) and Redis (6379)
```

## Live URLs

| What | URL |
|---|---|
| Production | https://axl.arxstudios.pro |
| Vercel default domain | https://arx-advanced-express-links.vercel.app |
| Health check | https://axl.arxstudios.pro/api/health |
| Source | https://github.com/arx-studios/arx-advanced-express-links |

## Glossary

| Term | Meaning |
|---|---|
| **Code** | The part after the slash: `axl.arxstudios.pro/`**`promo-oct`** |
| **Alias** | A code the user picked instead of a random one |
| **Canonical link** | The one plain link (no alias, no expiry) a user has for a given URL; returned again on repeat shortening |
| **Soft delete** | Marking a row deleted instead of removing it, so its code stays reserved |
| **Cache-aside** | Read the cache first; on a miss, read the database and fill the cache |
| **Negative caching** | Also caching "this code doesn't exist", briefly |
| **Keep-alive** | The daily cron job that prevents the free Supabase projects from pausing |
| **RLS** | Postgres Row Level Security; here used to deny Supabase's public API all access |
