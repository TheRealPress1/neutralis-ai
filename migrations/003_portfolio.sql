-- Portfolio state tables -- v3
-- Run this in Supabase Dashboard > SQL Editor

-- Trades: append-only execution records linking signals -> decisions -> positions
CREATE TABLE IF NOT EXISTS trades (
    id              TEXT PRIMARY KEY,
    signal_id       TEXT NOT NULL REFERENCES signals(id),
    decision_id     BIGINT NOT NULL REFERENCES decisions(id),
    ticker          TEXT NOT NULL,
    event_ticker    TEXT NOT NULL,
    venue           TEXT NOT NULL DEFAULT 'kalshi',
    side            TEXT NOT NULL,            -- 'buy_yes' or 'buy_no'
    price           DOUBLE PRECISION NOT NULL,
    size_dollars    DOUBLE PRECISION NOT NULL,
    quantity        DOUBLE PRECISION NOT NULL,
    is_paper        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trades_signal    ON trades (signal_id);
CREATE INDEX IF NOT EXISTS idx_trades_decision  ON trades (decision_id);
CREATE INDEX IF NOT EXISTS idx_trades_ticker    ON trades (ticker);
CREATE INDEX IF NOT EXISTS idx_trades_venue     ON trades (venue);
CREATE INDEX IF NOT EXISTS idx_trades_created   ON trades (created_at DESC);

-- Positions: mutable (open -> closed lifecycle)
CREATE TABLE IF NOT EXISTS positions (
    id              TEXT PRIMARY KEY,
    ticker          TEXT NOT NULL,
    event_ticker    TEXT NOT NULL,
    venue           TEXT NOT NULL DEFAULT 'kalshi',
    side            TEXT NOT NULL,            -- 'buy_yes' or 'buy_no'
    status          TEXT NOT NULL DEFAULT 'open',
    entry_price     DOUBLE PRECISION NOT NULL,
    size_dollars    DOUBLE PRECISION NOT NULL,
    quantity        DOUBLE PRECISION NOT NULL,
    realized_pnl    DOUBLE PRECISION NOT NULL DEFAULT 0,
    unrealized_pnl  DOUBLE PRECISION NOT NULL DEFAULT 0,
    trade_count     INTEGER NOT NULL DEFAULT 1,
    opened_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_positions_status       ON positions (status);
CREATE INDEX IF NOT EXISTS idx_positions_ticker       ON positions (ticker, status);
CREATE INDEX IF NOT EXISTS idx_positions_event        ON positions (event_ticker, status);
CREATE INDEX IF NOT EXISTS idx_positions_venue        ON positions (venue, status);
CREATE INDEX IF NOT EXISTS idx_positions_opened       ON positions (opened_at DESC);

-- Only one open position per ticker/venue/side combo
CREATE UNIQUE INDEX IF NOT EXISTS idx_positions_open_unique
    ON positions (ticker, venue, side) WHERE status = 'open';
