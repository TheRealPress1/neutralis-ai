-- Neutralis trading engine schema -- v1
-- Run this in Supabase Dashboard > SQL Editor

-- Market snapshots (append-only)
CREATE TABLE IF NOT EXISTS market_snapshots (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ticker          TEXT NOT NULL,
    event_ticker    TEXT NOT NULL,
    market_type     TEXT NOT NULL DEFAULT 'binary',
    title           TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'active',

    yes_bid         DOUBLE PRECISION NOT NULL,
    yes_ask         DOUBLE PRECISION NOT NULL,
    no_bid          DOUBLE PRECISION NOT NULL,
    no_ask          DOUBLE PRECISION NOT NULL,

    volume          DOUBLE PRECISION NOT NULL DEFAULT 0,
    volume_24h      DOUBLE PRECISION NOT NULL DEFAULT 0,
    liquidity       DOUBLE PRECISION NOT NULL DEFAULT 0,
    open_interest   DOUBLE PRECISION NOT NULL DEFAULT 0,
    notional_value  DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    close_time              TIMESTAMPTZ,
    expected_expiration     TIMESTAMPTZ,
    snapshot_ts             TIMESTAMPTZ NOT NULL DEFAULT now(),

    ob_yes_best_bid         DOUBLE PRECISION,
    ob_yes_best_bid_qty     DOUBLE PRECISION,
    ob_no_best_bid          DOUBLE PRECISION,
    ob_no_best_bid_qty      DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS idx_snapshots_ticker_ts
    ON market_snapshots (ticker, snapshot_ts DESC);

CREATE INDEX IF NOT EXISTS idx_snapshots_event_ticker
    ON market_snapshots (event_ticker);

CREATE INDEX IF NOT EXISTS idx_snapshots_snapshot_ts
    ON market_snapshots (snapshot_ts DESC);


-- Signals (scanner output)
CREATE TABLE IF NOT EXISTS signals (
    id              TEXT PRIMARY KEY,
    signal_type     TEXT NOT NULL DEFAULT 'complement_arb',
    ticker          TEXT NOT NULL,
    event_ticker    TEXT NOT NULL,

    yes_ask         DOUBLE PRECISION NOT NULL,
    no_ask          DOUBLE PRECISION NOT NULL,
    combined_cost   DOUBLE PRECISION NOT NULL,
    gross_edge      DOUBLE PRECISION NOT NULL,
    net_edge        DOUBLE PRECISION NOT NULL,
    edge_pct        DOUBLE PRECISION NOT NULL,

    snapshot_id     BIGINT REFERENCES market_snapshots(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signals_ticker ON signals (ticker);
CREATE INDEX IF NOT EXISTS idx_signals_created ON signals (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_edge ON signals (edge_pct DESC);


-- Decisions (guard output)
CREATE TABLE IF NOT EXISTS decisions (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    signal_id       TEXT NOT NULL REFERENCES signals(id),
    verdict         TEXT NOT NULL,

    guard_results   JSONB NOT NULL DEFAULT '[]'::jsonb,
    suggested_size  DOUBLE PRECISION NOT NULL DEFAULT 0,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decisions_signal ON decisions (signal_id);
CREATE INDEX IF NOT EXISTS idx_decisions_verdict ON decisions (verdict, created_at DESC);
