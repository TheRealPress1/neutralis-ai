-- 020: Audit log for security-sensitive events
-- Append-only table: users can read their own logs, no update/delete.

CREATE TABLE IF NOT EXISTS audit_log (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  event_type   TEXT NOT NULL,
  entity_type  TEXT,
  entity_id    TEXT,
  details      JSONB NOT NULL DEFAULT '{}',
  ip_address   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_created
  ON audit_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_event_type
  ON audit_log (event_type);

-- RLS: users can only read their own logs
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit logs"
  ON audit_log FOR SELECT
  USING (auth.uid() = user_id);

-- Allow authenticated users to insert their own logs
CREATE POLICY "Users can insert own audit logs"
  ON audit_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE or DELETE policies — append-only
