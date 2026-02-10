-- Alpha vNext schema upgrades
-- Adds: signal scoring, ranked selection, regime tracking, disagreement index

-- 1) Signals: scoring + capital efficiency fields
ALTER TABLE signals ADD COLUMN IF NOT EXISTS confidence_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE signals ADD COLUMN IF NOT EXISTS time_to_resolution_days DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE signals ADD COLUMN IF NOT EXISTS roi_per_day DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE signals ADD COLUMN IF NOT EXISTS features_json JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_signals_confidence ON signals (confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_signals_roi ON signals (roi_per_day DESC);

-- 2) Decisions: ranked selection fields
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS selected BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS selection_score DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS allocation_reasons JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 3) Regime states table
CREATE TABLE IF NOT EXISTS regime_states (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    regime          TEXT NOT NULL,
    metrics_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
    params_json     JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_regime_created ON regime_states (created_at DESC);

-- 4) Disagreement index table
CREATE TABLE IF NOT EXISTS disagreement_index (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    overall         DOUBLE PRECISION NOT NULL,
    by_category     JSONB NOT NULL DEFAULT '{}'::jsonb,
    sample_size     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_disagreement_created ON disagreement_index (created_at DESC);
