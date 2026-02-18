-- Migration 018: Automation state (singleton table for dashboard control)
--
-- Tracks the running/paused/killed status of the trading bot,
-- daily loss tracking, and drawdown metrics.

CREATE TABLE IF NOT EXISTS automation_state (
    id                    SERIAL PRIMARY KEY,
    status                TEXT NOT NULL DEFAULT 'paused',
    kill_switch           BOOLEAN NOT NULL DEFAULT FALSE,
    killed_reason         TEXT,
    started_at            TIMESTAMPTZ,
    paused_at             TIMESTAMPTZ DEFAULT NOW(),
    killed_at             TIMESTAMPTZ,
    daily_loss_dollars    NUMERIC NOT NULL DEFAULT 0,
    daily_loss_reset_at   TIMESTAMPTZ,
    peak_portfolio_value  NUMERIC NOT NULL DEFAULT 0,
    max_drawdown_dollars  NUMERIC NOT NULL DEFAULT 0,
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed with a single initial row (paused by default)
INSERT INTO automation_state (status, paused_at)
SELECT 'paused', NOW()
WHERE NOT EXISTS (SELECT 1 FROM automation_state);
