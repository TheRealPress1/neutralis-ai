-- 009_scheduler_runs.sql
-- Stores per-run scheduler metrics for observability and historical analysis.

CREATE TABLE IF NOT EXISTS scheduler_runs (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    run_number              INTEGER NOT NULL,
    duration_ms             DOUBLE PRECISION NOT NULL,
    kalshi_markets          INTEGER NOT NULL DEFAULT 0,
    poly_markets            INTEGER NOT NULL DEFAULT 0,
    complement_signals      INTEGER NOT NULL DEFAULT 0,
    cross_platform_signals  INTEGER NOT NULL DEFAULT 0,
    matches                 INTEGER NOT NULL DEFAULT 0,
    decisions_pass          INTEGER NOT NULL DEFAULT 0,
    decisions_reject        INTEGER NOT NULL DEFAULT 0,
    decisions_selected      INTEGER NOT NULL DEFAULT 0,
    open_positions          INTEGER NOT NULL DEFAULT 0,
    total_exposure          DOUBLE PRECISION NOT NULL DEFAULT 0,
    positions_settled       INTEGER NOT NULL DEFAULT 0,
    settlement_pnl          DOUBLE PRECISION NOT NULL DEFAULT 0,
    marked_positions        INTEGER NOT NULL DEFAULT 0,
    exits_triggered         INTEGER NOT NULL DEFAULT 0,
    exit_pnl                DOUBLE PRECISION NOT NULL DEFAULT 0,
    regime                  TEXT NOT NULL DEFAULT 'normal',
    disagreement_index      DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_scheduler_runs_created
    ON scheduler_runs (created_at DESC);
