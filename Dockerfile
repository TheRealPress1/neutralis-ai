FROM python:3.13-slim AS base

WORKDIR /app

# System deps for psycopg binary and cryptography
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY neutralis/ neutralis/
COPY scripts/ scripts/
COPY migrations/ migrations/

# ── API server ────────────────────────────────────────────────────
# Health: GET /api/health  (port 8000)
FROM base AS api
EXPOSE 8000
CMD ["python", "scripts/run_api.py"]

# ── Event daemon (real-time WebSocket engine) ─────────────────────
# Health: GET /health  (port 9091)
# Use when WEBSOCKET_ENABLED=true — real-time Kalshi ticks, <200ms latency
FROM base AS daemon
EXPOSE 9091
CMD ["python", "scripts/event_daemon.py"]

# ── Loop daemon (polling fallback) ───────────────────────────────
# Health: GET /health  (port 9091)
# Use when WEBSOCKET_ENABLED=false or as a simpler starting point
FROM base AS loop_daemon
EXPOSE 9091
CMD ["python", "scripts/loop_daemon.py"]
