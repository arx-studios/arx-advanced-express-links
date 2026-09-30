# 8. Operations runbook

## What runs by itself

| Mechanism | Frequency | Does |
|---|---|---|
| Keep-alive cron (`/api/cron/keepalive`) | Daily, 03:00 UTC (08:30 IST) ±59 min | Queries arxExpressLinks, writes the heartbeat in the ARX Studios project, flushes buffered clicks, pings Redis |
| Click flush on redirects | At most every 10s, triggered by traffic | Moves click counters from Redis to Postgres |
| Certificate renewal | Automatic (Vercel) | Renews the HTTPS certificate for `axl.arxstudios.pro` |
| Cache expiry | Automatic (Redis TTLs) | Redirect cache 24h, negative cache 60s, rate-limit windows 60s |

## Monitoring

| Where | What to look at |
|---|---|
| Vercel → **Settings → Cron Jobs → View Logs** | Each day's keep-alive run: `200` = fine, `500` = a Supabase ping failed. The `keepalive {…}` log line shows each part and its timing. |
| Vercel → **Logs** | Runtime errors. `cache read skipped…` or `redis: …` warnings mean Redis was slow or unreachable (redirects still work). |
| https://axl.arxstudios.pro/api/health | Liveness: `{"status":"ok"}` (doesn't touch Redis or Postgres) |
| Supabase → arxExpressLinks → **Reports** / **Security Advisor** | Database size, activity, security warnings |
| Render → axl-cache → **Metrics** | Memory use (25 MB limit), connections (50 limit) |

A normal keep-alive run on a fresh instance takes about 5s, almost all of it Render's
slow Redis login.

## Incidents

### Short links are slow, but work
**Likely cause:** Redis is unreachable, so every redirect falls back to Postgres (about
+0.5s).

1. Vercel logs: look for `redis: …` or `cache read skipped` warnings.
2. Render: is `axl-cache` **Available**? Did someone change its inbound IP rules?
3. Check from a laptop with `.env.render`:
   ```bash
   npx tsx --env-file=.env.render -e "import('ioredis').then(async ({Redis})=>{const r=new Redis(process.env.REDIS_URL);console.log(await r.ping());r.disconnect()})"
   ```
Nothing is lost except up to ~10s of un-flushed clicks. It recovers by itself once Redis
is back.

### Sign-in fails or pages error with 500
1. Is **arxstudios's Project** paused? Supabase dashboard → restore it.
2. Is **arxExpressLinks** paused? Restore it the same way.
3. Did someone change the auth project's **Redirect URLs** or Google provider?
4. Check the keep-alive logs for failed runs.

### Keep-alive run failed (500)
The response says which part: `"postgres":"error"` or `"authProject":"error"`.
- `postgres`: the database is paused, the password changed, or the CA certificate
  changed. Check `DATABASE_URL` and `DATABASE_CA_CERT` in Vercel.
- `authProject`: the `keepalive()` function was dropped (re-run the SQL from
  [Data model](05-data-model.md#arx-studios-project-the-heartbeat)), or the
  publishable key was rotated (update `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and
  redeploy).

A single missed day is harmless: pausing needs a full week without activity. Vercel
doesn't retry failed cron runs; use **Run** in Cron Jobs to trigger one by hand.

### A harmful link was reported
There's no admin UI yet. Disable it with SQL in Supabase (SQL Editor):
```sql
UPDATE links SET deleted_at = now(), is_canonical = false WHERE code = '<code>';
```
Cached redirects expire within 24h. To stop it immediately, also delete `link:<code>`
from Redis.

### The site is completely down
1. https://www.vercel-status.com, Supabase status, Render status.
2. Vercel → Deployments: did the last deploy fail? **Instant Rollback** to the previous one.
3. DNS: `nslookup axl.arxstudios.pro` should show the Vercel CNAME. Is the domain still
   registered?

## Maintenance checklist

| When | Task |
|---|---|
| **Now** | Turn on **auto-renew** for `arxstudios.pro` at Hostinger. If it lapses, every link breaks. |
| **Now** | Rotate the auth project's `sb_secret_…` key (it was exposed in a chat). |
| **Now** | Enable **Dependabot alerts and security updates** on the GitHub repo. |
| Monthly | Glance at the keep-alive cron logs and at new links (abuse). |
| When alerted | Apply Next.js and dependency security updates; test and push. |
| Before earning money | Move Vercel to **Pro** (Hobby is non-commercial only). |
| Before **April 2031** | Supabase's root CA (`Supabase Root 2021 CA`) expires: download the new certificate and update `DATABASE_CA_CERT` and `certs/`. |
| Read emails | Supabase, Vercel, Render, Hostinger: plan changes, runtime deprecations, Postgres upgrades. |

## Free-tier limits

| Service | Limit | Current risk |
|---|---|---|
| Supabase (each project) | Pauses after 1 week without database activity; 500 MB DB; 5 GB egress | Covered by the keep-alive |
| Supabase | 2 active free projects per account | Both are in use |
| Render Key Value | 25 MB, 50 connections, no persistence, may restart anytime | Fine; the app tolerates loss |
| Vercel Hobby | Cron once a day (±59 min); non-commercial use | Fine for now |

## Secrets: where they are and how to rotate them

| Secret | Rotate by |
|---|---|
| Database password | Supabase → Project Settings → Database → Reset password; update `DATABASE_URL` in Vercel (redeploy) and in `.env.supabase` |
| Redis password | Render → axl-cache → rotate/reset credentials; update `REDIS_URL` in Vercel (redeploy) and in `.env.render` |
| `CRON_SECRET` | Generate a new value; update it in Vercel; redeploy |
| Publishable key | Supabase auth project → API Keys; update in Vercel; redeploy (it's compiled into the browser bundle) |
