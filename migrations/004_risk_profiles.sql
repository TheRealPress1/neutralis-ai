-- Risk profile configuration -- v4
-- Run this in Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS risk_profiles (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            TEXT NOT NULL DEFAULT 'Default',
    preset          TEXT NOT NULL DEFAULT 'moderate',
    is_active       BOOLEAN NOT NULL DEFAULT FALSE,

    -- User-facing metadata
    target_annual_return_pct  DOUBLE PRECISION NOT NULL DEFAULT 15.0,
    description     TEXT NOT NULL DEFAULT '',

    -- Pipeline / Signal Quality (from PipelineConfig)
    min_edge_pct              DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    min_liquidity_dollars     DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    max_time_to_expiry_hours  DOUBLE PRECISION NOT NULL DEFAULT 720.0,
    min_time_to_expiry_hours  DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    fee_rate                  DOUBLE PRECISION NOT NULL DEFAULT 0.07,

    -- Position Sizing (from PipelineConfig)
    max_position_dollars      DOUBLE PRECISION NOT NULL DEFAULT 25.0,

    -- Portfolio Limits (from PortfolioConfig)
    max_total_exposure_dollars  DOUBLE PRECISION NOT NULL DEFAULT 500.0,
    max_event_exposure_dollars  DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    max_ticker_exposure_dollars DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    max_venue_exposure_pct      DOUBLE PRECISION NOT NULL DEFAULT 0.80,
    max_open_positions          INTEGER NOT NULL DEFAULT 50,

    -- Matching (from MatchingConfig)
    min_similarity              DOUBLE PRECISION NOT NULL DEFAULT 0.55,

    -- Multi-user future-proofing (nullable for now)
    user_id         UUID,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one active profile at a time (per user when auth arrives)
CREATE UNIQUE INDEX IF NOT EXISTS idx_risk_profiles_active
    ON risk_profiles (is_active) WHERE is_active = TRUE AND user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_risk_profiles_user
    ON risk_profiles (user_id) WHERE user_id IS NOT NULL;

-- Seed the three presets
INSERT INTO risk_profiles (
    name, preset, is_active, target_annual_return_pct, description,
    min_edge_pct, min_liquidity_dollars, max_time_to_expiry_hours,
    min_time_to_expiry_hours, fee_rate, max_position_dollars,
    max_total_exposure_dollars, max_event_exposure_dollars,
    max_ticker_exposure_dollars, max_venue_exposure_pct,
    max_open_positions, min_similarity
) VALUES
    ('Conservative', 'conservative', FALSE, 8.0,
     'Lower risk tolerance with tighter filters and smaller positions',
     3.0, 100.0, 720.0, 1.0, 0.07,
     15.0, 200.0, 50.0, 30.0, 0.80, 20, 0.65),

    ('Moderate', 'moderate', TRUE, 15.0,
     'Balanced approach matching current system defaults',
     1.0, 50.0, 720.0, 1.0, 0.07,
     25.0, 500.0, 100.0, 50.0, 0.80, 50, 0.55),

    ('Aggressive', 'aggressive', FALSE, 30.0,
     'Higher risk tolerance with looser filters and larger positions',
     0.5, 25.0, 720.0, 1.0, 0.07,
     50.0, 1500.0, 300.0, 150.0, 0.70, 100, 0.45);
