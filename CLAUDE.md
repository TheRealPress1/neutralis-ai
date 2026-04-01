# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Neutralis.ai is a prediction market arbitrage platform with two components:
1. **Python trading engine** — scans Kalshi and Polymarket (international + US/CFTC) for arbitrage opportunities, executes trades, manages positions
2. **Next.js frontend** — landing page, dashboard, auth, billing (Next.js 16 / React 19 / TypeScript / Tailwind 4)

## Common Commands

```bash
# Python pipeline
python scripts/run_once.py              # one-shot pipeline run
python scripts/event_daemon.py          # real-time WS-driven pipeline (WEBSOCKET_ENABLED=true)
python scripts/loop_daemon.py           # polling loop daemon (30s interval, fallback mode)
python scripts/run_api.py               # FastAPI dashboard API (port 8000)
python scripts/run_backtest.py          # backtest engine

# Tests (pytest, no config file — just invoke directly)
pytest tests/                           # all tests
pytest tests/test_execution.py          # single test file
pytest tests/test_execution.py::test_name  # single test

# Frontend
npm run dev                             # Next.js dev server (port 3000)
npm run build                           # production build
npm run lint                            # ESLint

# Docker
docker-compose up                       # starts api + daemon services
```

## Architecture

### Pipeline Flow (Python)

```
Venues (REST/WS) → Normalize → Match Pairs → Scan for Arbs → Score → Guard → Execute → Portfolio
```

**Two runtime modes:**
- **Event engine** (`engine/event_loop.py`): async WS-driven, sub-millisecond arb detection on ticker updates. Entry: `scripts/event_daemon.py`
- **Polling loop** (`scripts/loop_daemon.py`): calls `run_once()` every 30s with market cache for incremental updates

### Key Module Roles

| Module | Purpose |
|---|---|
| `venues/` | REST clients, WS clients, and normalizers for each exchange (Kalshi, Polymarket, Polymarket US) |
| `core/` | Matching (TF-IDF), scanning (complement, cross-platform, three-way, directional, settlement), scoring |
| `guard/` | Position sizing, bankroll limits, regime detection, signal evaluation |
| `execution/` | Order execution per venue, slippage modeling, fill simulation |
| `portfolio/` | Position tracking, mark-to-market, exit strategy evaluation |
| `fees/` | Exchange fee models (venue-specific) and performance fee accrual (user platform fees) |
| `storage/` | All DB I/O via psycopg3 (`PostgresStorage`) |

### Pair Discovery (3 layers, stacked with dedup)

1. **TF-IDF matcher** (`core/matcher.py`) — primary, text similarity matching
2. **Attena** (`core/attena_discovery.py`) — query-based alias discovery (opt-in: `ATTENA_DISCOVERY_ENABLED`)
3. **OddsPipe** (`core/oddspipe_discovery.py`) — pre-matched spreads from external API (opt-in: `ODDSPIPE_API_KEY`)

### Arb Types

- **Cross-platform**: same market on Kalshi vs Polymarket, prices diverge
- **Complement**: YES + NO on same venue sum > $1 or < $1
- **Three-way (Dutch book)**: soccer match markets (home/away/draw), combined asks < 1.00
- **Settlement**: exploit stale prices near market resolution
- **Directional**: high-probability single-leg signals

### Data Model

`NormalizedMarket` (`models.py`) is the universal market representation. All venue-specific data is normalized into this before any processing. Key fields: `venue`, `ticker`, `yes_ask`, `yes_bid`, `no_ask`, `no_bid`, `outcome_label`, `poly_fee_tier`, `clob_token_ids`.

### Frontend (Next.js)

App Router under `src/app/`. Supabase for auth + data. Stripe for billing. Pages: landing, dashboard, pricing, onboarding, docs. API routes under `src/app/api/` handle waitlist, dashboard data, Stripe webhooks.

## Configuration

All Python config loaded from `.env.local` in repo root (custom dotenv loader in `config.py`, no `python-dotenv` dependency). Settings are dataclasses in `neutralis/config.py` loaded via `load_settings()`.

### Required Environment Variables

- `SUPABASE_DB_URL` — Postgres DSN
- `KALSHI_API_KEY_ID`, `KALSHI_PRIVATE_KEY_PATH` — Kalshi RSA auth
- `POLYMARKET_PRIVATE_KEY`, `POLYMARKET_FUNDER_ADDRESS` — Polymarket CLOB
- `POLYMARKET_US_KEY_ID`, `POLYMARKET_US_SECRET_KEY` — Polymarket US

### Feature Flags (all optional)

- `WEBSOCKET_ENABLED` — enables event engine WS mode
- `POLYMARKET_WS_ENABLED`, `POLYMARKET_US_WS_ENABLED` — per-venue WS
- `PREFER_POLYMARKET_US` — prefer US venue for execution
- `LIVE_TRADING_ENABLED` — enables live order submission (default: true)

## Database

Postgres via Supabase. 24 sequential migrations in `migrations/` (001–024), applied manually. No migration runner bundled.

Key tables: `market_snapshots`, `signals`, `decisions`, `trades`, `positions`, `risk_profiles`, `regime_states`, `discrepancy_log`, `user_fee_state`, `fee_ledger`.

## Deployment

Railway (`railway.toml`). Two services from same repo using Dockerfile multi-stage targets:
- `daemon` target → event engine (port 9091, health: `/health`)
- `api` target → FastAPI dashboard (port 8000, health: `/api/health`)

## Kalshi API Gotchas

- Base URL: `https://api.elections.kalshi.com/trade-api/v2`
- Auth: RSA-PSS signing, message = `timestamp_ms + METHOD + /trade-api/v2 + path`
- Filter param is `statuses` (NOT `status`)
- Max page size: `limit=1000`, rate limit: ~100ms between requests
- Prices are dollar strings (`"0.5500"`) — convert with `float()`
- Parlays filtered via `mve_selected_legs` field or `mve_filter="exclude"` API param
- `>50k` active markets; general fetch caps at 50 pages, so targeted series fetch is needed for tournament markets

## Polymarket Fee Tiers

Fees are **category-specific**, not flat. Determined by `classify_poly_fee_tier()` in `fees/exchange.py`:
- `"standard"` (politics, entertainment, most sports): zero fees
- `"crypto"`: `0.25 * (P*(1-P))^2`
- `"sports_fee"`: `0.0175 * P*(1-P)`
- `"us_flat"` (Polymarket US/CFTC): 0.10% taker
