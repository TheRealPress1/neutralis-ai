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

# ── API target (FastAPI dashboard, port 8000) ──
FROM base AS api
ENV PORT=8000
EXPOSE 8000
CMD ["python", "scripts/run_api.py"]

# ── Daemon target (event engine, port 9091) ──
FROM base AS daemon
ENV PORT=9091
EXPOSE 9091
CMD ["python", "scripts/event_daemon.py"]

# ── Frontend target (Next.js, port 3000) ──
FROM node:22-slim AS frontend-build
WORKDIR /app

# NEXT_PUBLIC_* vars must be present at build time (baked into client JS bundle)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

COPY package.json package-lock.json* ./
RUN npm ci
COPY src/ src/
COPY public/ public/
COPY next.config.ts tsconfig.json postcss.config.mjs ./
RUN npm run build

FROM node:22-slim AS frontend
WORKDIR /app
COPY --from=frontend-build /app/.next .next
COPY --from=frontend-build /app/node_modules node_modules
COPY --from=frontend-build /app/package.json package.json
COPY --from=frontend-build /app/public public
ENV PORT=3000
EXPOSE 3000
CMD ["npm", "start"]
