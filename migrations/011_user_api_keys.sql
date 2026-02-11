-- User API keys for exchange connectivity
CREATE TABLE IF NOT EXISTS user_api_keys (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         UUID NOT NULL,
    platform        TEXT NOT NULL,              -- 'kalshi' | 'polymarket'
    api_key_id      TEXT NOT NULL DEFAULT '',    -- Kalshi: key ID; Polymarket: API key
    api_secret      TEXT NOT NULL DEFAULT '',    -- Polymarket: API secret
    private_key_pem TEXT NOT NULL DEFAULT '',    -- Kalshi: RSA private key PEM
    is_valid        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys (user_id);

-- RLS: users can only manage their own keys
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own keys"
    ON user_api_keys FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own keys"
    ON user_api_keys FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own keys"
    ON user_api_keys FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own keys"
    ON user_api_keys FOR DELETE
    USING (auth.uid() = user_id);
