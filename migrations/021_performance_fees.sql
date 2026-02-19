-- 021: Performance fee system with high-water mark
--
-- user_fee_state: mutable per-user fee tracking (HWM, cumulative P&L, accrued fees)
-- fee_ledger: append-only audit trail of every fee accrual event

-- ============================================================
-- user_fee_state
-- ============================================================

CREATE TABLE IF NOT EXISTS user_fee_state (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id                 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    high_water_mark         DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    cumulative_realized_pnl DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    total_fees_accrued      DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    current_tier            TEXT NOT NULL DEFAULT 'free',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT user_fee_state_tier_check
        CHECK (current_tier IN ('free', 'starter', 'pro', 'founder'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_fee_state_user
    ON user_fee_state (user_id);

-- RLS: users can read their own fee state
ALTER TABLE user_fee_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fee state"
    ON user_fee_state FOR SELECT
    USING (auth.uid() = user_id);

-- ============================================================
-- fee_ledger (append-only)
-- ============================================================

CREATE TABLE IF NOT EXISTS fee_ledger (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id                 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    position_id             TEXT NOT NULL,
    realized_pnl_delta      DOUBLE PRECISION NOT NULL,
    cumulative_pnl_before   DOUBLE PRECISION NOT NULL,
    cumulative_pnl_after    DOUBLE PRECISION NOT NULL,
    hwm_before              DOUBLE PRECISION NOT NULL,
    hwm_after               DOUBLE PRECISION NOT NULL,
    fee_rate                DOUBLE PRECISION NOT NULL,
    fee_amount              DOUBLE PRECISION NOT NULL,
    tier_at_time            TEXT NOT NULL,
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fee_ledger_user_created
    ON fee_ledger (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fee_ledger_position
    ON fee_ledger (position_id);

-- RLS: users can read their own ledger, no update/delete (append-only)
ALTER TABLE fee_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fee ledger"
    ON fee_ledger FOR SELECT
    USING (auth.uid() = user_id);

-- ============================================================
-- Triggers
-- ============================================================

-- Auto-create fee state when a new profile is created
CREATE OR REPLACE FUNCTION public.handle_new_profile_fee_state()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_fee_state (user_id, current_tier)
    VALUES (NEW.id, COALESCE(NEW.subscription_tier, 'free'))
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created_fee_state ON profiles;
CREATE TRIGGER on_profile_created_fee_state
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_profile_fee_state();

-- Sync tier changes from profiles → user_fee_state
CREATE OR REPLACE FUNCTION public.sync_subscription_tier_to_fee_state()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.subscription_tier IS DISTINCT FROM NEW.subscription_tier THEN
        UPDATE user_fee_state
        SET current_tier = NEW.subscription_tier,
            updated_at = now()
        WHERE user_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_tier_change ON profiles;
CREATE TRIGGER on_profile_tier_change
    AFTER UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_subscription_tier_to_fee_state();

-- ============================================================
-- Seed fee state for existing users
-- ============================================================

INSERT INTO user_fee_state (user_id, current_tier)
SELECT p.id, COALESCE(p.subscription_tier, 'free')
FROM profiles p
WHERE NOT EXISTS (
    SELECT 1 FROM user_fee_state ufs WHERE ufs.user_id = p.id
);
