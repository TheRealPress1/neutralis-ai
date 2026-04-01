# Deploying Neutralis on Railway

## Architecture

Three Railway services, all from this repo:

| Service | Docker target | Port | Health check | What it does |
|---------|--------------|------|--------------|-------------|
| `neutralis-frontend` | `frontend` | 3000 | `/` | Next.js dashboard |
| `neutralis-api` | `api` | 8000 | `/api/health` | FastAPI dashboard API |
| `neutralis-daemon` | `daemon` | 9091 | `/health` | Trading bot (WS engine) |

All services use the same `Dockerfile` with different build targets.

---

## Step-by-Step Setup

### 1. Create the Railway project

1. Go to [railway.app](https://railway.app) → New Project → **Empty Project**

### 2. Add the Frontend service

1. **+ Add Service** → **GitHub Repo** → select `neutralis-ai`
2. **Settings → Build**:
   - Builder: `Dockerfile`
   - Dockerfile path: `Dockerfile`
   - **Docker Build Target: `frontend`** ← critical
3. **Settings → Networking** → Generate Domain (public URL)
4. **Variables**:

```
PORT=3000
NEXT_PUBLIC_SUPABASE_URL=https://xbiifeqzbxfqpjrpdhjk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon key>
NEXT_PUBLIC_API_URL=https://<api-service-url>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
API_KEY_ENC_KEY=<32-byte hex key>
STRIPE_SECRET_KEY=<stripe key>
STRIPE_WEBHOOK_SECRET=<stripe webhook secret>
```

### 3. Add the API service

1. **+ Add Service** → **GitHub Repo** → same repo
2. **Docker Build Target: `api`**
3. **Settings → Deploy** → Health check path: `/api/health`
4. **Settings → Networking** → Generate Domain
5. **Variables**:

```
PORT=8000
SUPABASE_DB_URL=<your supabase postgres DSN>
API_KEY_ENC_KEY=<same key as frontend>
```

6. Copy the API service URL → set as `NEXT_PUBLIC_API_URL` on the frontend service

### 4. Add the Daemon service

1. **+ Add Service** → **GitHub Repo** → same repo
2. **Docker Build Target: `daemon`**
3. **Settings → Deploy** → Health check path: `/health`
4. **Variables**:

```
SUPABASE_DB_URL=<same postgres DSN>
API_KEY_ENC_KEY=<same key>
WEBSOCKET_ENABLED=true
LIVE_TRADING_ENABLED=true
```

### 5. Apply database migration

Run migration 025 in the Supabase SQL editor (Dashboard → SQL Editor):

```sql
-- Copy contents of migrations/025_pipeline_logs.sql
```

---

## Common Build Failures

### "No build target specified"
Each service MUST have `Docker Build Target` set in Settings → Build:
- Frontend: `frontend`
- API: `api`
- Daemon: `daemon`

### "npm: command not found"
You're building a Python target but Railway picked the wrong stage. Check Docker Build Target.

### "next: command not found" or build fails on TypeScript
Missing `NEXT_PUBLIC_*` env vars at build time. These must be set as **build variables** in Railway (Settings → Variables → check "Available at build time").

### Health check fails
- Frontend health: just responds on `/` (port 3000)
- API health: `/api/health` (port 8000)
- Daemon health: `/health` (port 9091)

Make sure the port matches what the service exposes.

---

## Environment Variables Reference

| Variable | Services | Required | Description |
|----------|----------|----------|-------------|
| `SUPABASE_DB_URL` | api, daemon | ✅ | Postgres DSN |
| `API_KEY_ENC_KEY` | all | ✅ | 32-byte hex key for credential encryption |
| `NEXT_PUBLIC_SUPABASE_URL` | frontend | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | frontend | ✅ | Supabase anon key |
| `NEXT_PUBLIC_API_URL` | frontend | ✅ | Railway URL of the API service |
| `SUPABASE_SERVICE_ROLE_KEY` | frontend | ✅ | Supabase service role key |
| `WEBSOCKET_ENABLED` | daemon | ⬜ | `true` for real-time WS engine |
| `LIVE_TRADING_ENABLED` | daemon | ⬜ | `true` to execute real orders |
| `STRIPE_SECRET_KEY` | frontend | ⬜ | Stripe billing |
| `STRIPE_WEBHOOK_SECRET` | frontend | ⬜ | Stripe webhooks |
| `DISCORD_WEBHOOK_URL` | daemon | ⬜ | Trade alerts |

---

## Cost Estimate

| Service | Monthly |
|---------|---------|
| Frontend (256MB) | ~$3-5 |
| API (256MB) | ~$3-5 |
| Daemon (512MB) | ~$5-10 |
| **Total** | **~$11-20** |

Railway Hobby plan ($5/mo) includes $5 usage credit.
