-- Add is_paper flag to positions so dashboard can exclude paper trades from P&L
ALTER TABLE positions ADD COLUMN IF NOT EXISTS is_paper BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: mark positions as paper if they have ONLY paper trades
UPDATE positions p SET is_paper = TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM trades t
    WHERE t.ticker = p.ticker AND t.venue = p.venue AND t.side = p.side
      AND t.is_paper = FALSE
)
AND EXISTS (
    SELECT 1 FROM trades t
    WHERE t.ticker = p.ticker AND t.venue = p.venue AND t.side = p.side
      AND t.is_paper = TRUE
);
