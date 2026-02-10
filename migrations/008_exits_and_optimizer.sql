-- 008_exits_and_optimizer.sql
-- Adds: position exit tracking, optimizer run storage

-- 1) Position exit tracking
ALTER TABLE positions ADD COLUMN IF NOT EXISTS exit_reason TEXT;
-- Values: NULL (still open or settled via old code), 'settlement', 'stop_loss', 'take_profit', 'time_decay'

ALTER TABLE positions ADD COLUMN IF NOT EXISTS exit_price DOUBLE PRECISION;
-- The bid price at which the exit was triggered (non-settlement exits)

CREATE INDEX IF NOT EXISTS idx_positions_exit_reason
    ON positions (exit_reason) WHERE exit_reason IS NOT NULL;

-- 2) Optimizer run results storage
CREATE TABLE IF NOT EXISTS optimizer_runs (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    start_date      TEXT NOT NULL,
    end_date        TEXT NOT NULL,
    objective       TEXT NOT NULL,
    total_combos    INTEGER NOT NULL,
    completed       INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'running',
    results_json    JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_optimizer_runs_created
    ON optimizer_runs (created_at DESC);
