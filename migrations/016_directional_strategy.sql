-- 016: High-Probability Directional Sports Strategy
-- Adds signal_type to positions for strategy isolation,
-- directional fields to signals, and index for filtered queries.

-- Add signal_type to positions for strategy isolation
ALTER TABLE positions ADD COLUMN IF NOT EXISTS signal_type TEXT NOT NULL DEFAULT '';
UPDATE positions SET signal_type = 'complement_arb' WHERE signal_type = '';
CREATE INDEX IF NOT EXISTS idx_positions_signal_type ON positions (signal_type, status);

-- Add directional fields to signals table
ALTER TABLE signals ADD COLUMN IF NOT EXISTS implied_probability DOUBLE PRECISION;
ALTER TABLE signals ADD COLUMN IF NOT EXISTS entry_side TEXT;
ALTER TABLE signals ADD COLUMN IF NOT EXISTS probability_floor DOUBLE PRECISION;
