# Kalshi manual trading

The web terminal reads the signed-in user's real Kalshi primary account and can submit reviewed buy limit orders. It does not call the Python daemon, use a shared exchange account, or fall back to simulated execution. Manual exchange writes are disabled by default.

## Deployment requirements

1. Apply `supabase/migrations/20261014_terminal_order_submissions.sql` to the application Supabase database. The ledger is required before any submission; a missing table fails closed.
2. Configure the existing Supabase URL, anonymous key, and `SUPABASE_SERVICE_ROLE_KEY`. The service-role key is used only on the server to claim and update submission records. Authenticated clients can read only their own records and cannot change uncertainty locks.
3. Configure the existing `API_KEY_ENC_KEY`, a 64-character hexadecimal AES key. Each user must connect a valid Kalshi API key through account settings. The terminal only decrypts the session user's `user_api_keys` row; legacy plaintext values are rejected.
4. Set `KALSHI_ORDER_PREVIEW_SECRET` to a separate, cryptographically random 32-byte secret encoded as 64 hex characters. Keep it server-side and stable across instances. Rotation invalidates outstanding reviews; do not rotate while uncertain submissions are awaiting reconciliation.
5. Keep `KALSHI_MANUAL_TRADING_ENABLED=false` until the deployment, migration, account permissions, and explicit confirmation flow have been verified. Setting it to the exact string `true` enables real exchange submissions and cancellation. Account reads and signed reviews can work while writes are disabled.

The implementation uses Kalshi production at `https://external-api.kalshi.com`. There is no implicit demo switch. No actual exchange order or cancellation was sent during development. Automated tests use generated test keys and mock network responses, so authenticated production permissions and real fill behavior have not been exercised.

## API contract

- `GET /api/terminal/account`: authenticated balance, recent orders/fills, current unsettled positions, and unresolved local submission. Orders are read from the exchange, including orders created outside Neutralis. Resting orders and positions are paginated; a bounded snapshot reports `partial: true` when more records exist. Primary subaccount only.
- `POST /api/terminal/orders/preview`: `{ticker, side: "yes" | "no", count, limitPrice}`. Prices are dollars and counts must be whole numbers from 1 through 1,000. Returns a signed 60-second review with a stable UUID `clientOrderId`.
- `POST /api/terminal/orders`: `{previewToken, confirmed: true}`. This is the only submission operation. Changes to contract, side, count, or price require a new review. Responses distinguish `accepted`, `rejected`, and `unknown`.
- `POST /api/terminal/orders/reconcile`: `{previewToken}`. Reads exchange state only, accepts an expired signed token, and never submits or retries an order. Preserve the original token while resolving an uncertain result. A review without a ledger claim remains uncertain until it expires, because the original HTTP request could still be running; after expiry it can safely report no recorded submission.
- `DELETE /api/terminal/orders/{exchangeOrderId}`: retrieves the order with that user's exchange credentials, verifies the primary account and remaining quantity, and cancels the remainder. Previously filled contracts remain positions. Cancellation timeout is reported as unknown; refresh account state.

Mutations require exact same-origin browser requests with a valid Supabase session. JSON requests are bounded to 8 KiB. Credentials, exchange response bodies, and private key material are not included in API responses or logs.

## Submission safety and limits

Signed reviews bind the exact order, application user, connected key, fee estimate, and expiry. The server refreshes contract status, market trading window, current `price_ranges`, exchange status, event/series fee metadata, and available balance immediately before submission. Unsupported contract or fee structures fail closed. The current implementation supports standard $1 binary contracts and quadratic/quadratic-with-maker-fees schedules. Combo, scalar, flat-fee, and unrecognized fee contracts are rejected.

The order is `good_till_canceled`, with cancellation on exchange pause and taker-side self-trade prevention. A buy-NO request maps to a V2 YES-book ask at `1 − NO limit`; buy-YES maps to a bid at the selected YES limit. Each order uses a stable `client_order_id` and auto-routing by ticker. The terminal does not yet offer position-close/sell controls or subaccount selection.

The fee estimate uses the event override when supplied, otherwise the current series type/multiplier. The displayed estimated total includes a conservative reserve for price improvement and rounding. It is **not an exchange-enforced fee cap**: actual fills and later fee schedule changes can affect fees on a resting order. The UI must describe this field as an estimated total, not a guaranteed maximum debit.

A durable ledger claim is inserted before the exchange write. A unique partial index permits only one unresolved submission per application user. Repeated confirmation of the same preview only reconciles the original ID. Timeouts, duplicate-ID conflicts, and upstream server failures never trigger another write or a new client ID. A definitive exchange rejection is recorded as rejected; acknowledgement is recorded as accepted, with filled and remaining quantities preserved separately.

If a process crashes after claiming an order but before learning its outcome, the unresolved lock remains. Missing results from a delayed or failed exchange read do not prove rejection. The account refresh and Check status action reconcile known orders directly. If an unresolved record cannot be reconciled (for example, the connected exchange key changed or the order moved beyond the live-history cutoff), restore access to the original account and investigate its exchange order/fill history. An operator must not clear an uncertainty lock merely because one lookup is empty. The terminal deliberately blocks new submissions until the uncertain result is resolved.

## Verification

Run on Node.js 22.18+ (native TypeScript stripping):

```sh
node --test src/lib/terminal/kalshi.test.mjs src/lib/terminal/trading-core.test.mjs src/lib/terminal/trading-execution.test.mjs src/lib/terminal/trading-server.test.mjs
```

Coverage includes RSA-PSS/Ed25519 signatures, YES/NO V2 price conversion, fixed-point read normalization, null/zero handling, mock successful/rejected/timed-out writes, strict inputs and price grids, same-origin checks, signed review tampering/ownership/expiry, concurrent claims, and no retries after uncertain outcomes.

Server integration tests execute the real route handlers and orchestration with in-memory Supabase and exchange boundaries. They verify per-user encrypted credential loading, unauthenticated/cross-origin rejection, default-off account reads and previews, missing-migration submission blocking, current fee/balance revalidation, credential-bound reconciliation, expired receipt recovery, and remaining-only cancellation. These tests cannot validate deployed database policies, exchange permissions, or real fills; those still require deployment verification.

## Official API references checked

- [Create Order V2](https://docs.kalshi.com/api-reference/orders/create-order-v2)
- [Cancel Order V2](https://docs.kalshi.com/api-reference/orders/cancel-order-v2)
- [Authenticated requests](https://docs.kalshi.com/getting_started/quick_start_authenticated_requests)
- [Order direction](https://docs.kalshi.com/getting_started/order_direction)
- [Fixed-point prices and dynamic price grids](https://docs.kalshi.com/getting_started/fixed_point_migration)
- [Series fee metadata](https://docs.kalshi.com/api-reference/market/get-series)
- [Event fee overrides](https://docs.kalshi.com/api-reference/events/get-event)
- [Fee rounding](https://docs.kalshi.com/getting_started/fee_rounding)
- [Current fee schedule](https://kalshi.com/docs/kalshi-fee-schedule.pdf)
