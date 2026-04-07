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

COPY package.json package-lock.json* ./
RUN npm ci
COPY .env.production* ./
COPY src/ src/
COPY public/ public/
COPY next.config.ts tsconfig.json postcss.config.mjs ./

# NEXT_PUBLIC_* must be present at build time (inlined into client JS bundle)
# These are public/client-safe keys, not secrets
ENV NEXT_PUBLIC_SUPABASE_URL=https://xbiifeqzbxfqpjrpdhjk.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaWlmZXF6YnhmcXBqcnBkaGprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NjUyMzksImV4cCI6MjA4NjI0MTIzOX0.x4qzv0Mj7itwOSMH194Zo-cZu26cClHNc5qoPTPe38A
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51T2FSpPmKg4lJxzMYZfoa4dVfq4NKTystawyLnLjNurj48ohV5MLAc67ltyre9BVh4xIXR8gIUIa7YeLafd9osLM00ibSArWTX
ENV NEXT_PUBLIC_SITE_URL=https://neutralis.ai

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
