# Setting up axl on a fresh machine

Use this after resetting or replacing your computer (Windows). It covers what to save
**before** the reset, then how to get back to a working setup: local development,
tests, and the ability to deploy and migrate production.

Production keeps running the whole time. It lives on Vercel, Supabase and Render, not
on your laptop, so resetting the machine doesn't affect the live site.

---

## Part 1: Before you reset

### 1. Make sure all code is on GitHub

```powershell
cd C:\Users\Ayush\Developer\SystemDesign\axlByARXStudios
git status                     # should say "nothing to commit, working tree clean"
git fetch
git log origin/main..main      # should print nothing (no unpushed commits)
```

### 2. Back up the files that only exist on this machine

Git deliberately ignores these because they contain secrets. Save them somewhere
**private**, such as a password manager or an encrypted USB drive. Not a public or shared
cloud folder.

| File | Contains | Needed for |
|---|---|---|
| `.env` | Local dev settings + the auth project's public URL and key | `npm run dev` |
| `.env.supabase` | Production database URL **with its password** | `npm run migrate:prod` |
| `.env.render` | Production Redis URL **with its password** | Redis diagnostics |
| `certs/prod-ca-2021.crt` | Supabase's public root certificate | `npm run migrate:prod` |

If you lose them, nothing is gone for good: Part 2, step 5 shows where to get every
value again from the dashboards.

### 3. Check that you can still log in everywhere

After a reset, you'll sign in again to each service. Make sure you have the passwords and,
if you use two-factor authentication, your **backup codes or authenticator app**:

GitHub · Vercel · Supabase · Render · Hostinger · Google (for the ARX Studios account)

### 4. Optional: Claude Code's notes about this project

Claude Code keeps project notes in
`C:\Users\Ayush\.claude\projects\c--Users-Ayush-Developer-SystemDesign-axlByARXStudios\memory\`.
Copy that folder if you want Claude to remember this project's decisions. The project
docs in `docs/` already cover the same ground.

Nothing in Docker needs saving: the local databases only hold test data.

---

## Part 2: After the reset

### 1. Install the tools

In PowerShell:

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e        # Node 24 LTS (axl needs Node 24+)
winget install --id Docker.DockerDesktop -e
winget install --id Microsoft.VisualStudioCode -e
```

Then:
- **Restart** the computer (Docker Desktop needs it, and WSL 2 if prompted).
- Open **Docker Desktop** once and let it finish starting.
- Open a **new** terminal and check:
  ```powershell
  git --version; node -v; npm -v; docker --version
  ```

The previous machine had Node 26, Git 2.55 and Docker 29. Any Node 24+ works.

### 2. Configure Git

```powershell
git config --global user.name  "Your Name"
git config --global user.email "you@example.com"
```

The first `git push` opens a browser window to sign in to GitHub (Git Credential
Manager, installed with Git).

### 3. Get the code

Clone to the **same path** as before, so paths in notes and Claude Code's memory still
match:

```powershell
mkdir C:\Users\Ayush\Developer\SystemDesign -Force
cd C:\Users\Ayush\Developer\SystemDesign
git clone https://github.com/arx-studios/arx-advanced-express-links.git axlByARXStudios
cd axlByARXStudios
npm install
```

npm may warn about install scripts waiting for approval (`esbuild`, `sharp`,
`unrs-resolver`). That's fine: they install working prebuilt binaries anyway.

### 4. Restore the secret files

Copy your backed-up `.env`, `.env.supabase`, `.env.render` and `certs/` folder into the
project folder. Then confirm git still ignores them:

```powershell
git status --short     # must NOT list .env*, certs/ or the .crt file
```

### 5. If you didn't back them up: recreate them

**`.env`** (local development). Start from the template:

```powershell
Copy-Item .env.example .env
```

Then fill in the two Supabase values from **Supabase → arxstudios's Project → Project
Settings → API Keys** (the project URL and the **publishable** key). Leave the rest as in
the template.

**`.env.supabase`** (production migrations):
1. Supabase → **arxExpressLinks** → **Connect** → **Transaction pooler** (port 6543) → copy
   the URI.
2. Fill in the database password. Forgot it? **Project Settings → Database → Reset
   database password** (letters and digits only). Then also update `DATABASE_URL` in
   **Vercel → Settings → Environment Variables** and redeploy, or production loses its
   database connection.
3. **Project Settings → Database → SSL Configuration → Download certificate** → save it as
   `certs/prod-ca-2021.crt`.
4. Create `.env.supabase`:
   ```
   DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
   DATABASE_CA_CERT_FILE=certs/prod-ca-2021.crt
   ```

**`.env.render`** (optional, for Redis diagnostics): Render → **axl-cache** → **Connect** →
**External** → copy the `rediss://` URL:
```
REDIS_URL=rediss://…
```

### 6. Start the local databases

```powershell
docker compose up -d
docker compose exec postgres createdb -U axl axl_dev
npm run migrate
```

Expected: `applied 001_init.sql`, then `migrations up to date`.

Local Postgres is on port **5433** and Redis on **6379**. If something else on the new
machine already uses one of those ports, change it in `docker-compose.yml` and `.env`.

### 7. Check everything works

```powershell
npm run typecheck      # no errors
npm run lint           # no errors
npm test               # all tests pass (needs step 6)
npm run build          # "Compiled successfully"
npm run dev            # http://localhost:3000
```

Then open **http://localhost:3000**, sign in with Google, create a link, and open it.
Sign-in works locally because `http://localhost:3000/auth/callback` is already on the
auth project's Redirect URLs list.

### 8. Check you can reach production

```powershell
npm run migrate:prod   # should print "connected to … (verified TLS)" and "migrations up to date"
```

This only applies migrations that haven't run yet, so on an up-to-date database it
changes nothing. If it connects, your production credentials are restored correctly.

Then check https://axl.arxstudios.pro/api/health returns `{"status":"ok"}`.

### 9. Optional extras

- **VS Code:** install the ESLint and Tailwind CSS IntelliSense extensions.
- **Claude Code memory:** copy the backed-up `memory` folder back to the same path under
  `C:\Users\Ayush\.claude\projects\`.
- **GitHub wiki:** it's a separate repository. Clone it only if you're editing the wiki:
  `git clone https://github.com/arx-studios/arx-advanced-express-links.wiki.git`

---

## Quick reference

| Task | Command |
|---|---|
| Start local databases | `docker compose up -d` |
| Run the app | `npm run dev` |
| Run tests | `npm test` |
| Deploy to production | `git push` (to `main`) |
| Apply a migration to production | `npm run migrate:prod` |

More detail: [docs/09-development.md](docs/09-development.md) (local development) and
[docs/07-infrastructure-and-deployment.md](docs/07-infrastructure-and-deployment.md)
(production setup).
