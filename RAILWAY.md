# Deploying Neutralis on Railway

## Architecture

Three Railway services, all from this repo:

| Service | Docker target | Port | What it does |
|---------|--------------|------|-------------|
| `neutralis-db` | (Railway Postgres plugin) | 5432 | State, positions, orders |
| `neutralis-daemon` | `daemon` or `loop_daemon` | 9091 | The trading bot |
| `neutralis-api` | `api` | 8000 | Dashboard API + Vercel frontend talks to this |

**Start with `loop_daemon`** (polling, simpler). Upgrade to `daemon` once you're live and want real-time WebSocket ticks from Kalshi.

---

## Step-by-Step Setup

### 1. Create the Railway project

1. Go to [railway.app](https://railway.app) → New Project
2. Choose **Empty Project**

---

### 2. Add PostgreSQL

1. In the project, click **+ Add Service** → **Database** → **PostgreSQL**
2. Once created, go to its **Variables** tab
3. Copy the `DATABASE_URL` — you'll use this as `DATABASE_URL` in both the daemon and API services

---

### 3. Add the Daemon service

1. **+ Add Service** → **GitHub Repo** → select `neutralis-ai`
2. In service **Settings → Build**:
   - Builder: `Dockerfile`
   - Dockerfile path: `Dockerfile`
   - Build target: `loop_daemon` ← start here; switch to `daemon` for WebSocket mode
3. In service **Settings → Deploy**:
   - Health check path: `/health`
   - Health check timeout: `60`
4. In service **Variables**, add:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}    ← Railway reference variable
API_KEY_ENC_KEY=<your 32-byte hex key>
KALSHI_API_KEY=<kalshi key id>
KALSHI_API_SECRET=<kalshi private key PEM>
POLYMARKET_API_KEY=<polymarket key>        ← optional for now
WEBSOCKET_ENABLED=false                    ← set true when switching to daemon target
```

5. Deploy → watch logs for `Health check passed: database reachable`

---

### 4. Add the API service

1. **+ Add Service** → **GitHub Repo** → same repo
2. Build target: `api`
3. Health check path: `/api/health`
4. Variables:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
API_KEY_ENC_KEY=<same key as daemon>
NEXT_PUBLIC_SUPABASE_URL=<your supabase url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
PORT=8000
```

5. In **Settings → Networking**, expose the service publicly → copy the Railway URL
6. Set that URL as `NEXT_PUBLIC_API_URL` in your Vercel env vars

---

### 5. Run migrations

Once the DB is live, open a Railway shell on the daemon service:

```bash
railway run python -c "
from neutralis.storage.postgres import PostgresStorage
from neutralis.config import load_settings
s = load_settings()
with PostgresStorage(s.db) as db:
    db.init_schema()
"
```

Or run the SQL migrations manually from `migrations/`.

---

## Switching to Real-Time Mode (WebSocket)

When ready to go full real-time:

1. In the daemon service, change build target: `loop_daemon` → `daemon`
2. Set `WEBSOCKET_ENABLED=true`
3. Redeploy

The event daemon connects to Kalshi WebSocket tickers and detects arbs in <200ms instead of polling every N seconds.

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `API_KEY_ENC_KEY` | ✅ | 32-byte hex key for encrypting API credentials at rest |
| `KALSHI_API_KEY` | ✅ | Kalshi API key ID |
| `KALSHI_API_SECRET` | ✅ | Kalshi RSA private key (PEM format) |
| `POLYMARKET_API_KEY` | ⬜ | Polymarket key (cross-platform arbs) |
| `POLYMARKET_API_SECRET` | ⬜ | Polymarket secret |
| `WEBSOCKET_ENABLED` | ⬜ | `true` for real-time daemon, `false` for polling (default: false) |
| `DISCORD_WEBHOOK_URL` | ⬜ | For trade alerts + heartbeat notifications |
| `PORT` | ⬜ | API server port (default: 8000) |

---

## Monitoring

- **Health endpoint (daemon):** `https://<daemon-url>/health`
- **Health endpoint (API):** `https://<api-url>/api/health`
- **Railway logs:** real-time in the dashboard
- **Discord alerts:** configured via `DISCORD_WEBHOOK_URL` — bot sends heartbeats every N runs and alerts on errors

---

## Cost Estimate

| | Monthly |
|-|---------|
| Postgres (512MB) | ~$5 |
| Daemon (512MB RAM) | ~$5–10 |
| API (512MB RAM) | ~$5 |
| **Total** | **~$15–20** |

Hobby plan ($5/mo) includes $5 of free usage credit. Starter plan ($10/mo dev + usage) is enough for both services.
