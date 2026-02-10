-- Automation state, audit logs, risk buckets -- v5
-- Run this in Supabase Dashboard > SQL Editor

-- Automation state: kill switch + pipeline run/pause control
CREATE TABLE IF NOT EXISTS automation_state (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    status          TEXT NOT NULL DEFAULT 'paused',   -- 'running', 'paused', 'killed'
    kill_switch     BOOLEAN NOT NULL DEFAULT FALSE,
    killed_reason   TEXT,
    paused_at       TIMESTAMPTZ,
    killed_at       TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    daily_loss_dollars    DOUBLE PRECISION NOT NULL DEFAULT 0,
    daily_loss_reset_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    peak_portfolio_value  DOUBLE PRECISION NOT NULL DEFAULT 0,
    max_drawdown_dollars  DOUBLE PRECISION NOT NULL DEFAULT 0,
    user_id         UUID,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial automation state (paused by default)
INSERT INTO automation_state (status, kill_switch) VALUES ('paused', FALSE);

-- Audit logs: full traceability for every pipeline event
CREATE TABLE IF NOT EXISTS audit_logs (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_type      TEXT NOT NULL,        -- 'signal_generated', 'risk_decision', 'order_placed',
                                          -- 'fill_recorded', 'position_opened', 'position_closed',
                                          -- 'kill_switch_triggered', 'automation_started',
                                          -- 'automation_paused', 'profile_changed', 'settlement'
    entity_type     TEXT,                 -- 'signal', 'decision', 'trade', 'position', 'automation'
    entity_id       TEXT,                 -- ID of the related entity
    details         JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type
    ON audit_logs (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
    ON audit_logs (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created
    ON audit_logs (created_at DESC);

-- Risk buckets: group markets into thematic risk categories
CREATE TABLE IF NOT EXISTS risk_buckets (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,         -- 'us_politics', 'macro_fed', 'weather', 'sports', 'crypto'
    display_name    TEXT NOT NULL,                -- 'US Politics', 'Macro / Fed', 'Weather', 'Sports', 'Crypto'
    max_exposure_pct DOUBLE PRECISION NOT NULL DEFAULT 0.25,   -- max 25% of portfolio per bucket
    keywords        TEXT[] NOT NULL DEFAULT '{}',              -- keyword patterns for auto-tagging
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Market-to-bucket mapping (a market can belong to multiple buckets)
CREATE TABLE IF NOT EXISTS market_bucket_map (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ticker          TEXT NOT NULL,
    bucket_id       BIGINT NOT NULL REFERENCES risk_buckets(id),
    confidence      DOUBLE PRECISION NOT NULL DEFAULT 1.0,   -- how confident the tag is (1.0 = manual/certain)
    tagged_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(ticker, bucket_id)
);

CREATE INDEX IF NOT EXISTS idx_market_bucket_ticker ON market_bucket_map (ticker);
CREATE INDEX IF NOT EXISTS idx_market_bucket_bucket ON market_bucket_map (bucket_id);

-- Add daily_loss_limit_dollars to risk_profiles
ALTER TABLE risk_profiles
    ADD COLUMN IF NOT EXISTS daily_loss_limit_dollars DOUBLE PRECISION NOT NULL DEFAULT 100.0;

-- Update existing presets with appropriate daily loss limits
UPDATE risk_profiles SET daily_loss_limit_dollars = 30.0 WHERE preset = 'conservative';
UPDATE risk_profiles SET daily_loss_limit_dollars = 100.0 WHERE preset = 'moderate';
UPDATE risk_profiles SET daily_loss_limit_dollars = 300.0 WHERE preset = 'aggressive';

-- Seed default risk buckets
INSERT INTO risk_buckets (name, display_name, max_exposure_pct, keywords) VALUES
    ('us_politics',  'US Politics',    0.25, ARRAY['election', 'president', 'trump', 'biden', 'congress', 'senate', 'house', 'republican', 'democrat', 'gop', 'dnc']),
    ('macro_fed',    'Macro / Fed',    0.25, ARRAY['fed', 'fomc', 'interest rate', 'inflation', 'cpi', 'gdp', 'recession', 'unemployment', 'treasury', 'yield']),
    ('weather',      'Weather',        0.20, ARRAY['hurricane', 'temperature', 'weather', 'storm', 'tornado', 'flood', 'drought', 'climate']),
    ('sports',       'Sports',         0.20, ARRAY['nfl', 'nba', 'mlb', 'nhl', 'super bowl', 'world series', 'championship', 'playoff']),
    ('crypto',       'Crypto',         0.15, ARRAY['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'solana', 'sol']),
    ('world',        'World Events',   0.20, ARRAY['ukraine', 'russia', 'china', 'taiwan', 'nato', 'war', 'conflict', 'trade war', 'tariff']),
    ('culture',      'Culture / Media', 0.15, ARRAY['oscar', 'grammy', 'emmy', 'box office', 'streaming', 'tiktok', 'twitter'])
ON CONFLICT (name) DO NOTHING;
