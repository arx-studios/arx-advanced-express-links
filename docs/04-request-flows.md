# 4. Request flows

Each flow below follows one request through the system. Participants:

- **Browser**: the user's browser or anyone opening a link
- **Proxy**: `proxy.ts`, the session refresher
- **App**: the Next.js route handler or page on Vercel (Singapore)
- **Redis**: Render Key Value
- **DB**: Postgres in Supabase arxExpressLinks
- **Auth**: Supabase Auth in the ARX Studios project

## 1. Signing in with Google

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant App as axl (Vercel)
    participant Auth as Supabase Auth (ARX Studios)
    participant G as Google

    B->>B: Click "Continue with Google" (components/sign-in-form.tsx)
    B->>Auth: signInWithOAuth(google, redirectTo=/auth/callback)
    Auth->>G: OAuth consent
    G-->>Auth: Authorization granted
    Auth-->>B: Redirect to axl.arxstudios.pro/auth/callback?code=…
    Note over Auth,B: Only allowed because the URL is on the<br/>project's Redirect URLs list
    B->>App: GET /auth/callback?code=…
    App->>Auth: exchangeCodeForSession(code)
    Auth-->>App: Session (signed JWT + refresh token)
    App-->>B: Set session cookie, 302 → /dashboard
```

**Email magic link** works the same way: `signInWithOtp` emails a link, and clicking it
lands on `/auth/callback?token_hash=…&type=…`, which calls `verifyOtp` instead.

## 2. Any signed-in request: verifying the user

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant Proxy as proxy.ts
    participant App as Route / page
    participant Auth as Supabase Auth

    B->>Proxy: Request with session cookie
    Proxy->>Proxy: getClaims(): refresh the session cookie if it's expiring
    Proxy->>App: Continue (with refreshed cookie)
    App->>App: getUser() → getClaims() verifies the JWT signature
    Note over App,Auth: Public keys (JWKS) are fetched once and cached,<br/>so verification is local: no call per request
    alt valid session
        App->>App: user = { id: sub, email }
    else no / invalid session
        App-->>B: 401 (API) or redirect to /signin (pages)
    end
```

Short-link redirects (`/<code>`) are **not** in the proxy's matcher, so they skip all of
this.

## 3. Creating a link

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser (dashboard)
    participant App as POST /api/links
    participant Redis
    participant DB

    B->>B: Same URL shortened before (no alias/expiry)? Show cached result, stop.
    B->>App: POST { url, alias?, expiresAt? }
    App->>App: getUser() → 401 if signed out
    App->>Redis: Rate limit: INCR + EXPIRE NX + TTL (MULTI), ≤1s
    alt over 10/minute
        App-->>B: 429 + Retry-After
    end
    App->>App: Validate: JSON, zod schema, reserved alias,<br/>expiry in the future, http(s) URL, not axl itself
    App->>DB: UPSERT users (id, email)
    alt alias given
        App->>DB: INSERT … (code = alias)
        DB-->>App: unique violation? → 409 "Alias is taken"
    else plain link (no alias, no expiry)
        App->>DB: SELECT canonical link for (owner, URL)
        DB-->>App: found → return it with 200
        App->>DB: INSERT … is_canonical ON CONFLICT DO NOTHING (random code)
        Note over App,DB: Code collision → retry with a new code (≤5).<br/>No row returned → a concurrent request won: fetch theirs, 200.
    else expiring link
        App->>DB: INSERT … (random code, expires_at)
    end
    App->>Redis: DEL link:<code> (clear any cached "doesn't exist"), ≤500ms
    App-->>B: 201 { code, shortUrl, longUrl, createdAt, expiresAt, clickCount }
```

## 4. Following a short link (the hot path)

```mermaid
sequenceDiagram
    autonumber
    participant V as Visitor
    participant App as GET /[code]
    participant Redis
    participant DB

    V->>App: GET /promo-oct
    App->>App: Code matches ^[A-Za-z0-9_-]{3,32}$? No → 404 immediately
    App->>Redis: GET link:promo-oct (wait ≤500ms)
    alt cache hit
        Redis-->>App: https://example.com/…
    else cached "__none__"
        App-->>V: 404 "Link not found"
    else cache miss
        App->>DB: SELECT … WHERE code = $1 AND deleted_at IS NULL
        alt found and not expired
            App->>Redis: SET link:promo-oct <url> EX min(24h, time to expiry)
        else missing or expired
            App->>Redis: SET link:promo-oct __none__ EX 60
            App-->>V: 404 "Link not found"
        end
    else Redis slow / down
        App->>DB: SELECT … (and skip the cache write)
    end
    App-->>V: 302 Location: https://example.com/…
    Note over App,Redis: after() runs once the response is sent:
    App->>Redis: INCR clicks:promo-oct
    App->>Redis: SET lock:click-flush 1 NX EX 10
    opt won the lock (≤ once per 10s)
        App->>Redis: SCAN clicks:* → GETDEL each
        App->>DB: UPDATE links SET click_count = click_count + n
    end
```

The 404 is an HTML page for browsers (`Accept: text/html`) and `{"error":"Not found"}` for
scripts. Both are real `404` responses.

## 5. Loading the dashboard

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant Page as /dashboard (server)
    participant Redis
    participant DB

    B->>Page: GET /dashboard
    Page->>Page: getUser() → redirect to /signin if signed out
    Page->>DB: SELECT … WHERE owner_id = $1 AND deleted_at IS NULL<br/>ORDER BY id DESC LIMIT 21
    Page->>Redis: MGET clicks:<code> for the 20 links (≤500ms)
    Page-->>B: HTML with the first page of links (click counts = DB + buffered)
    B->>B: "Load more" → GET /api/links?cursor=<last id>
```

## 6. Deleting a link

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant App as DELETE /api/links/[code]
    participant DB
    participant Redis

    B->>B: Click trash icon, then confirm "Delete"
    B->>App: DELETE /api/links/promo-oct
    App->>App: getUser() → 401 if signed out
    App->>DB: UPDATE links SET deleted_at = now(), is_canonical = false<br/>WHERE code = $1 AND owner_id = $2 AND deleted_at IS NULL
    alt 1 row updated
        App->>Redis: DEL link:promo-oct (stop redirecting now)
        App-->>B: 204
    else 0 rows (not yours, or doesn't exist)
        App-->>B: 404 (same answer either way, so codes can't be probed)
    end
```

## 7. The daily keep-alive

```mermaid
sequenceDiagram
    autonumber
    participant Cron as Vercel Cron (03:00 UTC ±59 min)
    participant App as GET /api/cron/keepalive
    participant DB as Postgres (arxExpressLinks)
    participant AP as ARX Studios project (REST)
    participant Redis

    Cron->>App: GET with Authorization: Bearer $CRON_SECRET
    App->>App: Constant-time compare with CRON_SECRET → 401 if wrong
    App->>DB: SELECT count(*) FROM links
    App->>AP: POST /rest/v1/rpc/keepalive (apikey = publishable key)
    AP-->>App: heartbeat timestamp (one-row upsert)
    App->>Redis: wait until connected (≤10s), PING
    App->>Redis: flush buffered clicks (SCAN + GETDEL)
    App->>DB: UPDATE click counts
    App->>App: console.log("keepalive", result + timingsMs)
    App-->>Cron: 200, or 500 if either Supabase ping failed
```
