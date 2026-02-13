-- Polymarket wallet credentials, curated market mappings, and arb signals.

-- polymarket_credentials: one row per wallet, encrypted L2 creds optional
CREATE TABLE IF NOT EXISTS polymarket_credentials (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    wallet_address  TEXT NOT NULL UNIQUE,
    api_key_enc     TEXT,       -- Fernet-encrypted, NULL until L2 creds provided
    api_secret_enc  TEXT,
    passphrase_enc  TEXT,
    connected_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- market_mappings: curated registry of Kalshi <-> Polymarket equivalents
-- (separate from existing auto-detected market_matches)
CREATE TABLE IF NOT EXISTS market_mappings (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kalshi_ticker           TEXT NOT NULL,
    polymarket_token_id_yes TEXT NOT NULL,
    title                   TEXT NOT NULL DEFAULT '',
    resolution_notes        TEXT,
    match_confidence        DOUBLE PRECISION NOT NULL,
    active                  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(kalshi_ticker, polymarket_token_id_yes)
);

-- arb_signals: one row per mapping per scan tick
CREATE TABLE IF NOT EXISTS arb_signals (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mapping_id          BIGINT NOT NULL REFERENCES market_mappings(id),
    ts                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    kalshi_bid          DOUBLE PRECISION NOT NULL,
    kalshi_ask          DOUBLE PRECISION NOT NULL,
    poly_bid            DOUBLE PRECISION NOT NULL,
    poly_ask            DOUBLE PRECISION NOT NULL,
    edge_kalshi_to_poly DOUBLE PRECISION NOT NULL DEFAULT 0,
    edge_poly_to_kalshi DOUBLE PRECISION NOT NULL DEFAULT 0,
    liquidity_notes     TEXT
);

CREATE INDEX IF NOT EXISTS idx_arb_signals_mapping_id ON arb_signals (mapping_id);
CREATE INDEX IF NOT EXISTS idx_arb_signals_ts ON arb_signals (ts DESC);
CREATE INDEX IF NOT EXISTS idx_market_mappings_active ON market_mappings (active) WHERE active = TRUE;
