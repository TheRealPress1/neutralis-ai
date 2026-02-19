-- Add high-water mark P&L column for trailing stop persistence
ALTER TABLE positions ADD COLUMN IF NOT EXISTS hwm_pnl_pct DOUBLE PRECISION NOT NULL DEFAULT 0;
