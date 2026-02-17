-- 015: Discrepancy log — records every cross-platform price gap observation
-- for analytics on frequency, magnitude, and duration of arb opportunities.

CREATE TABLE IF NOT EXISTS discrepancy_log (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ts              TIMESTAMPTZ NOT NULL DEFAULT now(),
    kalshi_ticker   TEXT NOT NULL,
    poly_ticker     TEXT NOT NULL,
    kalshi_yes_bid  DOUBLE PRECISION NOT NULL,
    kalshi_yes_ask  DOUBLE PRECISION NOT NULL,
    poly_yes_bid    DOUBLE PRECISION NOT NULL,
    poly_yes_ask    DOUBLE PRECISION NOT NULL,
    mid_discrepancy DOUBLE PRECISION NOT NULL,
    gross_edge      DOUBLE PRECISION NOT NULL,
    net_edge        DOUBLE PRECISION NOT NULL,
    edge_pct        DOUBLE PRECISION NOT NULL,
    favored_venue   TEXT NOT NULL,
    match_confidence DOUBLE PRECISION NOT NULL,
    trigger_source  TEXT NOT NULL DEFAULT 'kalshi_ws',
    actionable      BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_discrepancy_log_ts
    ON discrepancy_log (ts DESC);
CREATE INDEX IF NOT EXISTS idx_discrepancy_log_kalshi_ticker
    ON discrepancy_log (kalshi_ticker, ts DESC);
CREATE INDEX IF NOT EXISTS idx_discrepancy_log_actionable
    ON discrepancy_log (actionable, ts DESC);
