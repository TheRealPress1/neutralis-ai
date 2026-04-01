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
ENV PORT=8000
EXPOSE 8000
CMD ["python", "scripts/run_api.py"]

# ── Event daemon (real-time WebSocket engine) ─────────────────────
# Health: GET /health  (port 9091)
FROM base AS daemon
EXPOSE 9091
CMD ["python", "scripts/event_daemon.py"]

# ── Loop daemon (polling fallback) ───────────────────────────────
# Health: GET /health  (port 9091)
FROM base AS loop_daemon
EXPOSE 9091
CMD ["python", "scripts/loop_daemon.py"]

# ── Next.js frontend ─────────────────────────────────────────────
FROM node:20-slim AS frontend

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Build args for Next.js public env vars (injected at build time)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_URL

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

ENV PORT=3000
EXPOSE 3000
CMD ["npm", "start"]
