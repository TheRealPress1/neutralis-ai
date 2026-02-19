-- Migration 023: Multi-tenant user scoping
-- Adds user_id to pipeline tables so positions/trades are per-user.
-- Run in Supabase Dashboard > SQL Editor

-- 1. Add user_id to pipeline tables (nullable for backward compat with existing rows)
ALTER TABLE signals ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE automation_state ADD COLUMN IF NOT EXISTS user_id UUID;

-- 2. Indexes for per-user queries
CREATE INDEX IF NOT EXISTS idx_signals_user ON signals (user_id);
CREATE INDEX IF NOT EXISTS idx_decisions_user ON decisions (user_id);
CREATE INDEX IF NOT EXISTS idx_trades_user ON trades (user_id);
CREATE INDEX IF NOT EXISTS idx_positions_user ON positions (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_state_user ON automation_state (user_id);

-- 3. Positions unique index: now per-user (two users can hold the same position)
DROP INDEX IF EXISTS idx_positions_open_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_positions_open_unique_user
    ON positions (ticker, venue, side, user_id) WHERE status = 'open';

-- 4. Execution priority on profiles (founders=1, pro=2, starter=3, free=4)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS execution_priority INTEGER NOT NULL DEFAULT 4;
