-- Time horizon preference for risk profiles -- v24
-- Allows users to focus on live/short-term markets vs long-dated ones.
-- Run this in Supabase Dashboard > SQL Editor (after 023_multi_tenant.sql)

ALTER TABLE risk_profiles
  ADD COLUMN IF NOT EXISTS time_horizon TEXT NOT NULL DEFAULT 'all';

-- Valid values: 'live' (72h), 'short_term' (1w), 'medium_term' (30d),
--               'long_term' (90d), 'all' (~5y, default)
-- Existing profiles keep 'all' to preserve current behaviour.
