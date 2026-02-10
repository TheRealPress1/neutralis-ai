-- Per-category risk overrides & curated strategy profiles -- v5
-- Run this in Supabase Dashboard > SQL Editor (after 004_risk_profiles.sql)

-- Add category overrides (JSONB) and strategy slug to risk_profiles
ALTER TABLE risk_profiles
  ADD COLUMN IF NOT EXISTS category_overrides JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS strategy TEXT;

-- Drop the partial unique index so multiple strategy rows can coexist with is_active=FALSE
-- (The application layer enforces one-active-at-a-time via activate_profile)
DROP INDEX IF EXISTS idx_risk_profiles_active;

-- Re-create a looser unique index: only one active per user_id bucket
CREATE UNIQUE INDEX idx_risk_profiles_active
    ON risk_profiles (COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid))
    WHERE is_active = TRUE;

-- Seed 6 curated strategy profiles
INSERT INTO risk_profiles (
    name, preset, is_active, strategy, target_annual_return_pct, description,
    min_edge_pct, min_liquidity_dollars, max_time_to_expiry_hours,
    min_time_to_expiry_hours, fee_rate, max_position_dollars,
    max_total_exposure_dollars, max_event_exposure_dollars,
    max_ticker_exposure_dollars, max_venue_exposure_pct,
    max_open_positions, min_similarity, category_overrides
) VALUES
    -- 1. Balanced: even exposure across all categories
    ('Balanced', 'moderate', FALSE, 'balanced', 15.0,
     'Even exposure across all market categories with moderate risk',
     1.0, 50.0, 720.0, 1.0, 0.07, 25.0,
     500.0, 100.0, 50.0, 0.80, 50, 0.55,
     '{"politics":{"enabled":true,"risk_level":"moderate","max_exposure_dollars":100},"economics":{"enabled":true,"risk_level":"moderate","max_exposure_dollars":100},"crypto":{"enabled":true,"risk_level":"moderate","max_exposure_dollars":100},"sports":{"enabled":true,"risk_level":"moderate","max_exposure_dollars":100},"entertainment":{"enabled":true,"risk_level":"moderate","max_exposure_dollars":100},"science_tech":{"enabled":true,"risk_level":"moderate","max_exposure_dollars":100},"weather":{"enabled":true,"risk_level":"moderate","max_exposure_dollars":100},"other":{"enabled":true,"risk_level":"moderate","max_exposure_dollars":100}}'::jsonb),

    -- 2. Politics Focus: heavy on political markets
    ('Politics Focus', 'moderate', FALSE, 'politics_focus', 20.0,
     'Concentrate on political and government-related markets',
     1.0, 50.0, 720.0, 1.0, 0.07, 30.0,
     600.0, 150.0, 75.0, 0.80, 60, 0.55,
     '{"politics":{"enabled":true,"risk_level":"aggressive","max_exposure_dollars":300},"economics":{"enabled":true,"risk_level":"moderate","max_exposure_dollars":150},"crypto":{"enabled":true,"risk_level":"conservative","max_exposure_dollars":50},"sports":{"enabled":false,"risk_level":"moderate","max_exposure_dollars":null},"entertainment":{"enabled":false,"risk_level":"moderate","max_exposure_dollars":null},"science_tech":{"enabled":true,"risk_level":"moderate","max_exposure_dollars":75},"weather":{"enabled":true,"risk_level":"conservative","max_exposure_dollars":50},"other":{"enabled":true,"risk_level":"conservative","max_exposure_dollars":50}}'::jsonb),

    -- 3. Sports Specialist: sports-centric
    ('Sports Specialist', 'moderate', FALSE, 'sports_specialist', 18.0,
     'Focus on sporting events with conservative non-sports exposure',
     1.0, 50.0, 720.0, 1.0, 0.07, 30.0,
     500.0, 120.0, 60.0, 0.80, 50, 0.55,
     '{"politics":{"enabled":true,"risk_level":"conservative","max_exposure_dollars":50},"economics":{"enabled":true,"risk_level":"conservative","max_exposure_dollars":50},"crypto":{"enabled":true,"risk_level":"conservative","max_exposure_dollars":50},"sports":{"enabled":true,"risk_level":"aggressive","max_exposure_dollars":300},"entertainment":{"enabled":true,"risk_level":"moderate","max_exposure_dollars":75},"science_tech":{"enabled":true,"risk_level":"conservative","max_exposure_dollars":50},"weather":{"enabled":false,"risk_level":"moderate","max_exposure_dollars":null},"other":{"enabled":true,"risk_level":"conservative","max_exposure_dollars":50}}'::jsonb),

    -- 4. High Conviction: few categories, high confidence
    ('High Conviction', 'conservative', FALSE, 'high_conviction', 12.0,
     'Only trade Politics and Economics with aggressive sizing',
     2.0, 75.0, 720.0, 1.0, 0.07, 20.0,
     400.0, 100.0, 50.0, 0.80, 30, 0.60,
     '{"politics":{"enabled":true,"risk_level":"aggressive","max_exposure_dollars":200},"economics":{"enabled":true,"risk_level":"aggressive","max_exposure_dollars":200},"crypto":{"enabled":false,"risk_level":"moderate","max_exposure_dollars":null},"sports":{"enabled":false,"risk_level":"moderate","max_exposure_dollars":null},"entertainment":{"enabled":false,"risk_level":"moderate","max_exposure_dollars":null},"science_tech":{"enabled":false,"risk_level":"moderate","max_exposure_dollars":null},"weather":{"enabled":false,"risk_level":"moderate","max_exposure_dollars":null},"other":{"enabled":false,"risk_level":"moderate","max_exposure_dollars":null}}'::jsonb),

    -- 5. Wide Net: all categories aggressive
    ('Wide Net', 'aggressive', FALSE, 'wide_net', 30.0,
     'Maximum category coverage with aggressive risk across the board',
     0.5, 25.0, 720.0, 1.0, 0.07, 50.0,
     1500.0, 300.0, 150.0, 0.70, 100, 0.45,
     '{"politics":{"enabled":true,"risk_level":"aggressive","max_exposure_dollars":200},"economics":{"enabled":true,"risk_level":"aggressive","max_exposure_dollars":200},"crypto":{"enabled":true,"risk_level":"aggressive","max_exposure_dollars":200},"sports":{"enabled":true,"risk_level":"aggressive","max_exposure_dollars":200},"entertainment":{"enabled":true,"risk_level":"aggressive","max_exposure_dollars":200},"science_tech":{"enabled":true,"risk_level":"aggressive","max_exposure_dollars":200},"weather":{"enabled":true,"risk_level":"aggressive","max_exposure_dollars":200},"other":{"enabled":true,"risk_level":"aggressive","max_exposure_dollars":200}}'::jsonb),

    -- 6. Crypto & Finance: digital assets + macro focus
    ('Crypto & Finance', 'moderate', FALSE, 'crypto_finance', 22.0,
     'Focus on cryptocurrency and economic/financial markets',
     0.8, 40.0, 720.0, 1.0, 0.07, 35.0,
     700.0, 150.0, 75.0, 0.80, 60, 0.50,
     '{"politics":{"enabled":true,"risk_level":"moderate","max_exposure_dollars":100},"economics":{"enabled":true,"risk_level":"aggressive","max_exposure_dollars":250},"crypto":{"enabled":true,"risk_level":"aggressive","max_exposure_dollars":250},"sports":{"enabled":false,"risk_level":"moderate","max_exposure_dollars":null},"entertainment":{"enabled":false,"risk_level":"moderate","max_exposure_dollars":null},"science_tech":{"enabled":true,"risk_level":"moderate","max_exposure_dollars":100},"weather":{"enabled":false,"risk_level":"moderate","max_exposure_dollars":null},"other":{"enabled":true,"risk_level":"conservative","max_exposure_dollars":50}}'::jsonb);
