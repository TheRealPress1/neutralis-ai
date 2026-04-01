-- Pipeline logs for real-time dashboard log stream
CREATE TABLE IF NOT EXISTS pipeline_logs (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID,
  level        TEXT NOT NULL DEFAULT 'info',
  category     TEXT NOT NULL DEFAULT 'engine',
  message      TEXT NOT NULL,
  details      JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_logs_user_created
  ON pipeline_logs (user_id, created_at DESC);

-- RLS
ALTER TABLE pipeline_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own logs"
  ON pipeline_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service insert logs"
  ON pipeline_logs FOR INSERT
  WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE pipeline_logs;

-- Composite index for market browser DISTINCT ON (ticker, venue) ORDER BY snapshot_ts DESC
CREATE INDEX IF NOT EXISTS idx_market_snapshots_ticker_venue_ts
  ON market_snapshots (ticker, venue, snapshot_ts DESC);

-- Auto-prune: delete logs older than 24h (run via pg_cron or app-side)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('prune-pipeline-logs', '0 * * * *',
--   $$DELETE FROM pipeline_logs WHERE created_at < now() - interval '24 hours'$$);
