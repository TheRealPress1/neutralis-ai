-- Per-user API key isolation and RLS enforcement -- v14

-- 1. Re-assert RLS on user_api_keys (idempotent)
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own keys" ON user_api_keys;
DROP POLICY IF EXISTS "Users can insert own keys" ON user_api_keys;
DROP POLICY IF EXISTS "Users can update own keys" ON user_api_keys;
DROP POLICY IF EXISTS "Users can delete own keys" ON user_api_keys;

CREATE POLICY "Users can view own keys"
    ON user_api_keys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own keys"
    ON user_api_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own keys"
    ON user_api_keys FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own keys"
    ON user_api_keys FOR DELETE USING (auth.uid() = user_id);

-- 2. Add user_id to polymarket_credentials
ALTER TABLE polymarket_credentials ADD COLUMN IF NOT EXISTS user_id UUID;

-- Drop the old wallet-only uniqueness, add per-user uniqueness
DROP INDEX IF EXISTS polymarket_credentials_wallet_address_key;
ALTER TABLE polymarket_credentials DROP CONSTRAINT IF EXISTS polymarket_credentials_wallet_address_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_polymarket_creds_user_wallet
    ON polymarket_credentials (user_id, wallet_address);

-- RLS on polymarket_credentials
ALTER TABLE polymarket_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own polymarket creds" ON polymarket_credentials;
DROP POLICY IF EXISTS "Users can insert own polymarket creds" ON polymarket_credentials;
DROP POLICY IF EXISTS "Users can update own polymarket creds" ON polymarket_credentials;
DROP POLICY IF EXISTS "Users can delete own polymarket creds" ON polymarket_credentials;

CREATE POLICY "Users can view own polymarket creds"
    ON polymarket_credentials FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own polymarket creds"
    ON polymarket_credentials FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own polymarket creds"
    ON polymarket_credentials FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own polymarket creds"
    ON polymarket_credentials FOR DELETE USING (auth.uid() = user_id);
