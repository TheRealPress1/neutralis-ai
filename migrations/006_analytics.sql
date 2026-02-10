-- Migration 006: Add category column to positions for analytics
-- Run in Supabase SQL Editor

-- Add category column to positions
ALTER TABLE positions ADD COLUMN category TEXT NOT NULL DEFAULT 'other';

-- Backfill existing positions using market_snapshots titles
UPDATE positions p
SET category = CASE
  WHEN ms.title ~* 'election|president|congress|senate|governor|democrat|republican|impeach|ballot' THEN 'politics'
  WHEN ms.title ~* 'gdp|inflation|\yfed\y|interest rate|unemployment|jobs report|recession|treasury' THEN 'economics'
  WHEN ms.title ~* 'bitcoin|ethereum|crypto|token|defi|blockchain|\ybtc\y|\yeth\y|solana' THEN 'crypto'
  WHEN ms.title ~* '\ynfl\y|\ynba\y|\ymlb\y|soccer|tennis|championship|playoff|super bowl|world cup' THEN 'sports'
  WHEN ms.title ~* 'oscar|grammy|emmy|box office|movie|tv show|album|netflix|spotify' THEN 'entertainment'
  WHEN ms.title ~* 'spacex|nasa|\yai\y|\yfda\y|patent|\yipo\y|apple|google' THEN 'science_tech'
  WHEN ms.title ~* 'hurricane|tornado|temperature|rainfall|wildfire|earthquake|storm' THEN 'weather'
  ELSE 'other'
END
FROM market_snapshots ms
WHERE ms.ticker = p.ticker;

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_positions_closed_at ON positions (closed_at) WHERE status = 'closed';
CREATE INDEX IF NOT EXISTS idx_positions_category ON positions (category);
