-- Cross-platform matching and signal tables -- v2

-- Add venue column to existing market_snapshots table
ALTER TABLE market_snapshots ADD COLUMN IF NOT EXISTS venue TEXT NOT NULL DEFAULT 'kalshi';
CREATE INDEX IF NOT EXISTS idx_snapshots_venue ON market_snapshots (venue);

-- Persisted market matches (all matches above similarity threshold)
CREATE TABLE IF NOT EXISTS market_matches (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kalshi_ticker           TEXT NOT NULL,
    kalshi_title            TEXT NOT NULL DEFAULT '',
    polymarket_id           TEXT NOT NULL,
    polymarket_question     TEXT NOT NULL DEFAULT '',
    match_confidence        DOUBLE PRECISION NOT NULL,
    kalshi_snapshot_id      BIGINT REFERENCES market_snapshots(id),
    polymarket_snapshot_id  BIGINT REFERENCES market_snapshots(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_matches_kalshi     ON market_matches (kalshi_ticker);
CREATE INDEX IF NOT EXISTS idx_matches_poly       ON market_matches (polymarket_id);
CREATE INDEX IF NOT EXISTS idx_matches_confidence ON market_matches (match_confidence DESC);
CREATE INDEX IF NOT EXISTS idx_matches_created    ON market_matches (created_at DESC);

-- Cross-platform price discrepancy signals
CREATE TABLE IF NOT EXISTS cross_platform_signals (
    id                      TEXT PRIMARY KEY,
    signal_type             TEXT NOT NULL DEFAULT 'cross_platform_discrepancy',
    kalshi_ticker           TEXT NOT NULL,
    kalshi_yes_ask          DOUBLE PRECISION NOT NULL,
    kalshi_no_ask           DOUBLE PRECISION NOT NULL,
    polymarket_id           TEXT NOT NULL,
    polymarket_yes_price    DOUBLE PRECISION NOT NULL,
    polymarket_no_price     DOUBLE PRECISION NOT NULL,
    match_confidence        DOUBLE PRECISION NOT NULL,
    price_discrepancy_pct   DOUBLE PRECISION NOT NULL,
    favored_venue           TEXT NOT NULL,
    match_id                BIGINT REFERENCES market_matches(id),
    kalshi_snapshot_id      BIGINT REFERENCES market_snapshots(id),
    polymarket_snapshot_id  BIGINT REFERENCES market_snapshots(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xp_signals_kalshi      ON cross_platform_signals (kalshi_ticker);
CREATE INDEX IF NOT EXISTS idx_xp_signals_poly        ON cross_platform_signals (polymarket_id);
CREATE INDEX IF NOT EXISTS idx_xp_signals_discrepancy ON cross_platform_signals (price_discrepancy_pct DESC);
CREATE INDEX IF NOT EXISTS idx_xp_signals_created     ON cross_platform_signals (created_at DESC);
