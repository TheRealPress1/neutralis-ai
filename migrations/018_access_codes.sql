-- 018: Access code system + hidden founder flag
-- Replaces visible 'founder' tier with hidden is_founder boolean.
-- Adds single-use access codes that grant Pro-level access.

-- 1. Add founder flag
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_founder BOOLEAN NOT NULL DEFAULT false;

-- 2. Migrate existing founder-tier rows
UPDATE profiles
  SET is_founder = true, subscription_tier = 'pro'
  WHERE subscription_tier = 'founder';

-- 3. Remove founder from tier constraint
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'starter', 'pro'));

-- 4. Access codes table
CREATE TABLE IF NOT EXISTS access_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,
  created_by  UUID NOT NULL REFERENCES profiles(id),
  redeemed_by UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  redeemed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_access_codes_code ON access_codes(code);
