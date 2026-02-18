CREATE TABLE access_codes (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,
    created_by  UUID NOT NULL REFERENCES auth.users(id),
    redeemed_by UUID REFERENCES auth.users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    redeemed_at TIMESTAMPTZ
);

ALTER TABLE access_codes ENABLE ROW LEVEL SECURITY;

-- Founders can see codes they created
CREATE POLICY "Creators can view their own codes"
    ON access_codes FOR SELECT
    USING (created_by = auth.uid());

-- Any authenticated user can look up a code to redeem it
CREATE POLICY "Users can look up codes for redemption"
    ON access_codes FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Founders can insert codes
CREATE POLICY "Creators can insert codes"
    ON access_codes FOR INSERT
    WITH CHECK (created_by = auth.uid());

-- Any authenticated user can redeem (update) an unredeemed code
CREATE POLICY "Users can redeem codes"
    ON access_codes FOR UPDATE
    USING (redeemed_by IS NULL AND auth.uid() IS NOT NULL)
    WITH CHECK (redeemed_by = auth.uid());
