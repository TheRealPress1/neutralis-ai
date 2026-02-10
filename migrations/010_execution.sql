-- Paper execution layer: orders and fills
-- Orders track the intent to trade; fills track simulated executions.

CREATE TABLE IF NOT EXISTS orders (
    id                      TEXT PRIMARY KEY,
    tick_id                 TEXT NOT NULL,
    signal_id               TEXT NOT NULL REFERENCES signals(id),
    decision_id             BIGINT NOT NULL REFERENCES decisions(id),
    ticker                  TEXT NOT NULL,
    event_ticker            TEXT NOT NULL,
    venue                   TEXT NOT NULL DEFAULT 'kalshi',
    side                    TEXT NOT NULL,            -- 'buy_yes' | 'buy_no'
    order_type              TEXT NOT NULL DEFAULT 'market',
    requested_price         DOUBLE PRECISION NOT NULL,
    requested_size_dollars  DOUBLE PRECISION NOT NULL,
    requested_quantity      DOUBLE PRECISION NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'pending',  -- pending/filled/partial/cancelled
    filled_size_dollars     DOUBLE PRECISION NOT NULL DEFAULT 0,
    filled_quantity         DOUBLE PRECISION NOT NULL DEFAULT 0,
    fill_count              INTEGER NOT NULL DEFAULT 0,
    avg_fill_price          DOUBLE PRECISION,
    slippage_bps            DOUBLE PRECISION,
    fees_dollars            DOUBLE PRECISION NOT NULL DEFAULT 0,
    is_paper                BOOLEAN NOT NULL DEFAULT TRUE,
    user_id                 UUID DEFAULT '00000000-0000-0000-0000-000000000000',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    expired_at              TIMESTAMPTZ
);

-- Idempotency: same tick + decision + ticker + side = skip
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotent
    ON orders (tick_id, decision_id, ticker, side);

CREATE INDEX IF NOT EXISTS idx_orders_signal_id ON orders (signal_id);
CREATE INDEX IF NOT EXISTS idx_orders_decision_id ON orders (decision_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_venue ON orders (venue);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_tick_id ON orders (tick_id);


CREATE TABLE IF NOT EXISTS fills (
    id                  TEXT PRIMARY KEY,
    order_id            TEXT NOT NULL REFERENCES orders(id),
    fill_number         INTEGER NOT NULL DEFAULT 1,
    price               DOUBLE PRECISION NOT NULL,
    quantity            DOUBLE PRECISION NOT NULL,
    size_dollars        DOUBLE PRECISION NOT NULL,
    fee_dollars         DOUBLE PRECISION NOT NULL DEFAULT 0,
    slippage_bps        DOUBLE PRECISION NOT NULL DEFAULT 0,
    liquidity_consumed  DOUBLE PRECISION NOT NULL DEFAULT 0,
    trade_id            TEXT REFERENCES trades(id),
    is_paper            BOOLEAN NOT NULL DEFAULT TRUE,
    user_id             UUID DEFAULT '00000000-0000-0000-0000-000000000000',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fills_order_number
    ON fills (order_id, fill_number);

CREATE INDEX IF NOT EXISTS idx_fills_order_id ON fills (order_id);
CREATE INDEX IF NOT EXISTS idx_fills_trade_id ON fills (trade_id);
CREATE INDEX IF NOT EXISTS idx_fills_created_at ON fills (created_at DESC);
