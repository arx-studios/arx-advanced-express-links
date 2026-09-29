# axl

A URL shortener: Node + TypeScript + Fastify + Postgres + Redis.

**Building it? Start at [docs/GUIDE.md](docs/GUIDE.md).**

## Run

```bash
cp .env.example .env
docker compose up -d     # Postgres on :5433, Redis on :6379
npm run migrate
npm run dev              # http://localhost:3000
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start with auto-reload |
| `npm run migrate` | Apply pending SQL migrations |
| `npm test` | Run tests (integration tests need Docker running) |
| `npm run typecheck` | Type-check without emitting |
| `npm run build` / `npm start` | Compile to `dist/` and run it |

## API

| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/api/links` | `{ url, alias?, expiresAt? }` | `201 { code, shortUrl, longUrl, expiresAt }` |
| `GET` | `/:code` | — | `302` redirect, or `404` |
| `GET` | `/health` | — | `{ status: "ok" }` |
