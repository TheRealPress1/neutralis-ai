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
FROM base AS api
EXPOSE 8000
CMD ["python", "scripts/run_api.py"]

# ── Event daemon (real-time WebSocket engine) ─────────────────────
FROM base AS daemon
EXPOSE 9091
CMD ["python", "scripts/event_daemon.py"]
