# ARB003 venue response contracts — preparation, not implementation

Prepared 2026-09-07 UTC by the independent response-contract researcher. Inspected checkout: `.context/arb002-review-c01`, exact HEAD `8f0d9359a871870f2f8a51d9718c5c90cf7c0b5b`. Installed SDKs inspected as text: `py-clob-client==0.34.6`, `polymarket-us==0.1.2` in `.context/arb002-review-venv/lib/python3.13/site-packages/`. No clients were constructed, no account/venue endpoints called, no product modules imported, and no M1 tests run. Public documentation reads were confined to documentation hosts.

This enables an M2 ticket to name faithful synthetic inputs. It does not validate current deployed API compatibility. Distinguish **source observation**, **current vendor documentation**, and **proposed accounting policy** below. A field's presence in a TypedDict is not evidence that every actual response supplies it.

## Immediate conclusions

1. Submission identity alone never proves a fill. Current international responses preserve raw JSON, while the US adapter destroys the execution detail its installed SDK can carry. Kalshi returns the full order object but consumers read a legacy quantity field and order limit price.
2. Event quantities and order totals are different inputs: applying cumulative `2 → 5 → 5` as fills would incorrectly book 12 contracts. Explicitly classify evidence as an execution event or an order snapshot before ledger application.
3. Current public docs contain newer schema generations than the repository's integration. Name endpoint/transport/schema generation on fixtures. Do not infer units from number magnitude, treat SDK-normalized events as raw REST JSON, or silently upgrade dependencies as part of normalization.

## Kalshi

### Existing adapter and consumers

- `neutralis/execution/kalshi.py:186`: submits legacy `/portfolio/orders`, with requested `count`, `side`, `action=buy`, `yes_price` or `no_price`; returns the complete response at line 240. `get_order` and cancellation also return raw objects at lines242–248. No fill-list method is implemented here.
- Lines233–238 read `order.status`, integer `order.fill_count`, and `order.order_id` for logging. The request's client ID is useful correlation evidence, not an execution ID.
- `neutralis/portfolio/manager.py:118` matches the returned dictionary; lines130–147 use `yes_price`/`no_price` as a fill price and can fall back to requested quantity/price. These are implementation behaviors, not vendor confirmation.
- `neutralis/engine/event_loop.py:2519` reads legacy `fill_count` for the maker path. `tests/arbitrage/conftest.py:16` supplies a synthetic `fill_price` field: no reviewed Kalshi schema establishes that field. That M1 double proves dispatch controls only and must not become an M2 source of truth.

### Current documented data

The current [Get Order response](https://docs.kalshi.com/api-reference/orders/get-order) carries `order_id`, `client_order_id`, `ticker`, status, cumulative `fill_count_fp`, `remaining_count_fp`, `initial_count_fp`, and cumulative maker/taker cost and fee fields. `yes_price_dollars`/`no_price_dollars` describe the order price, not an individual execution price. The distinct fields are `maker_fill_cost_dollars`, `taker_fill_cost_dollars`, `maker_fees_dollars`, `taker_fees_dollars`. A status and an ID alone do not provide actual consideration.

The [Fill schema](https://docs.kalshi.com/api-reference/portfolio/get-fills), checked against [OpenAPI 3.29.0](https://docs.kalshi.com/openapi.yaml), explicitly defines `fill_id` as a unique fill identifier and `trade_id` as its legacy alias. Each fill contains `order_id`, `ticker`/legacy `market_ticker`, per-fill `count_fp`, side-specific execution prices, `fee_cost`, taker flag, time, and account/shard context where supplied. Preserve the original identifiers rather than inventing uniqueness from order ID. Recent and historical fills have separate endpoints; the existing adapter does not collect either automatically.

[Fixed-point documentation](https://docs.kalshi.com/getting_started/fixed_point_migration), updated August 20, 2026, specifies dollar strings and fractional contract strings. Parse as decimal values: `"2.50"` means 2.5 contracts, not 250 or 2. `_fp` values can have two decimals; prices can have four. Do not round an observed fill to the original integer order size. Older integer fields require an explicitly named legacy contract.

The current OpenAPI additionally distinguishes `outcome_side`/`book_side` from legacy `side`/`action`: directional exposure can combine buy-yes with sell-no. It therefore cannot recover the original buy/sell action on its own. Preserve the original request association and available legacy fields; validate contradictions instead of inferring action from directional exposure. The new order-submission route has a separate V2 shape; this task neither migrates the adapter nor establishes that the legacy route remains available.

### Suitable synthetic cases and unresolved details

- A resting order with `fill_count_fp="0.00"`: accepted/resting, zero confirmed quantity.
- A resting/canceled order with positive cumulative filled quantity: preserve executed exposure; its remainder state does not erase it.
- Fill events with distinct IDs, decimal quantity and explicit execution prices; replay the same ID without duplicating quantity or fees.
- Cumulative snapshots 2 → 5 → 5: compare order totals; never emit three independent fills. If later individual events overlap an already applied cumulative snapshot, reconciliation must prevent double accounting.
- Cost totals can support a weighted-average execution price only when quantity/cost direction, currency, completeness and schema have been validated. They cannot manufacture per-trade IDs or reconstruct individual fill prices.
- Missing fees remain unknown. `fee_cost` is actual returned fee evidence; a schedule estimate is separate. Negative corrections/rebates require an explicit later correction policy rather than a blanket nonnegative check.

## Polymarket international

### Existing adapter and SDK boundary

- `neutralis/execution/polymarket.py:225` creates/signs then posts a market FOK order; line263 returns the raw dictionary. Its success log at line259 says filled based only on `success`.
- The GTC limit path similarly returns the raw dictionary at line338. Timeouts return synthetic `success=False`, blank order ID; that is local timeout evidence, not an exchange rejection or proof the worker did not submit.
- Installed `py_clob_client/client.py:623` posts and returns the HTTP JSON unchanged; `http_helpers/helpers.py:60` performs no response-schema validation. SDK `get_order` exists at line797; `get_trades` at line808 auto-paginates into a **list**, unlike the raw REST envelope. These reconciliation methods are not exposed by Neutralis's adapter. No automatic retrieval is authorized by this document.

### Current documented data and version distinction

[Post order](https://docs.polymarket.com/api-reference/trade/post-a-new-order) distinguishes `success`, `orderID`, `status`, amount strings and optional trade/transaction references. `success` means processing succeeded. A documented live-order example includes amounts while resting; those amounts alone cannot establish execution. Signed/request `makerAmount`/`takerAmount` are not the same fields as response `makingAmount`/`takingAmount` and cannot be substituted for them.

[Order lifecycle](https://docs.polymarket.com/concepts/order-lifecycle) separates resting/delayed/matched order states from trade settlement. `MATCHED` and `MINED` are not terminal finality; `CONFIRMED` succeeds, `FAILED` fails, and `RETRYING` remains unresolved. **Proposed policy:** retain matched exposure and settlement state separately; do not book a final successful settlement or blindly resubmit an unresolved order. The accounting contract must decide when provisional exposure becomes confirmed inventory; it must not silently equate matching with finality.

[Authenticated REST trades](https://docs.polymarket.com/api-reference/trade/get-trades) identify a trade by `id` and correlate `taker_order_id`, market, token `asset_id`, side, `size`, `price`, status, timestamps and transaction hash. Maker allocations appear under `maker_orders` with their own `order_id`, `matched_amount`, price, token, side and owner. Allocate only the matching account/order leg. A maker must not claim the whole taker trade or sum every maker's allocation. `fee_rate_bps` describes a rate, not a charged currency amount; actual fees cannot be filled in as zero merely because a rate or charge is absent.

The [current raw REST OpenAPI](https://docs.polymarket.com/api-spec/clob-openapi.yaml), version 1.0.0, explicitly describes `OpenOrder.original_size` and `size_matched` as six-decimal fixed-math and uses `ORDER_STATUS_*`/`TRADE_STATUS_*` values. Its `Trade.size` and maker `matched_amount` descriptions do not themselves establish a scale. By contrast, [current raw WebSocket examples](https://docs.polymarket.com/trading/realtime-order-updates) show quantities such as `"10"`, `asset_id`, and unprefixed `MATCHED`, while unified SDK examples use normalized token/time fields. Do not reuse one decoder across these shapes without a proven conversion contract. Repeated updates of one trade's settlement status are updates, not additional fill quantity.

[Current SDK migration guidance](https://docs.polymarket.com/getting-started/migrate-from-previous-sdks) describes a unified SDK beyond the repository's pinned legacy client. It does not prove what the legacy client's production responses currently look like. Unit/status compatibility is therefore a named precondition for positive REST-fill fixtures. Preserve uncertain raw values and return an unresolved outcome until the chosen transport/version contract supplies units. A later SDK migration is a separate compatibility decision.

### Suitable synthetic cases

- `success=True` plus order ID, but no execution evidence: accepted/unknown, not a requested-size position.
- A response with amounts and `status=live`: still not a fill.
- Same trade ID progressing MATCHED→MINED→CONFIRMED: at most one quantity application; explicit settlement transitions.
- Maker and taker views of the same match: bind to the original order/token/side, do not reuse the aggregate across legs.
- REST and WebSocket examples deliberately labelled as different contracts; reject an unknown scale/status combination rather than heuristically scaling by 1e6.
- Network timeout followed by a late result: preserve late evidence under the original request identity. No automatic resubmission from a blank timeout order ID.

## Polymarket US

### Existing adapter and installed SDK

- `neutralis/execution/polymarket_us.py:126` normalizes to only `success,errorMsg,orderID`. Lines144–164 use substring `FILL`, which accepts both partial/full names without retaining their quantities; lines173–179 accept any order ID. Lines257/336/421 then lose the original detailed response on market, limit and close-position paths.
- Installed `polymarket_us/types/orders.py:70` defines `Order`; line95 defines `Execution`; line129 defines `CreateOrderResponse`. Resource `orders.py:24` returns raw POST JSON, so retaining it does not require guessing a new SDK object. `orders.py:40` supplies a retrieve method. Its cancel method at line44 returns None; a successful cancellation call is not a synthetic fill receipt.

| Field | Supported meaning | Kind |
| --- | --- | --- |
| response `id` | Exchange order ID | Acceptance/correlation |
| `executions[].id` | Exchange execution ID | Execution-event identity |
| `executions[].tradeId` | Trade ID for a fill | Preserve alongside execution ID |
| `type` | Exact execution enum, including NEW, PARTIAL_FILL, FILL, CANCELED, REJECTED | Event classification |
| `lastShares` | Quantity of this execution, decimal string | Incremental fill quantity |
| `lastPx.value`, `.currency` | Price of this execution | Actual execution price |
| `commissionNotionalCollected` | Commission amount for this execution | Incremental charge |
| nested `order.cumQuantity` | Total executed contracts on the order | Cumulative snapshot |
| `order.leavesQuantity` | Unexecuted contracts remaining | Remaining snapshot |
| `order.avgPx` | Average execution price | Cumulative snapshot |
| `order.commissionNotionalTotalCollected` | Total collected order commissions | Cumulative charge |
| order ID, marketSlug, side, intent; execution time | Correlation and timestamp evidence | Preserve and validate |

The [Create Order embedded schema](https://docs.polymarket.us/api-reference/orders/create-order.md), Orders API v1.0.0, supplies these definitions explicitly. Synchronous execution waits only up to `maxBlockTime`; an ID with no execution is still not a completed fill. Current docs permit fractional quantities although installed SDK 0.1.2 types order quantities as integers; TypedDict annotations do not coerce the raw JSON. The [private WebSocket documentation](https://docs.polymarket.us/api-reference/websocket/private) confirms fractional `lastShares` examples. Keep `Decimal` semantics and preserve currency. Do not interpret a partial-fill enum as completed order status.

The current US REST schema also supplies `outcomeSide`, `action` and additional execution/leg fields absent from the old SDK annotations. Preserve raw extra fields, but do not create unsupported meanings. Exact cross-transport guarantees for execution-ID reuse, trade-ID multiplicity and correction events still need clarification; retain both IDs and order context, and do not assert trade ID alone is globally unique.

### Suitable synthetic cases

- An ID and an empty execution list: accepted/unknown, zero confirmed quantity.
- NEW, CANCELED or REJECTED event with no valid fill: no fill merely because an ID is present.
- PARTIAL_FILL with `lastShares="2"` followed by FILL with `lastShares="3"`, nested cumulative quantities 2 then 5 and final leaves 0: five executed contracts, not seven. Repeat either event without duplicate quantity/commission application.
- Partial-contract `lastShares="0.25"` with explicit execution price; do not truncate.
- Mixed fill and rejection/cancellation events: retain every valid fill and the final remainder state. An unrelated/stale reject string must not erase genuine fills, but substring matching is not validation.
- Per-event fees plus cumulative order fees: reconcile; do not add both. Missing charge and malformed quantity/price remain explicit unknowns.
- A close-position acknowledgement without executions must not flatten exposure or realize P&L.

## Proposed common fixture envelope and acceptance boundaries

Envelope metadata is **our internal proposal**, not vendor JSON: original user/run/request/leg identity, venue route, account/subaccount, submitted instrument/token/outcome/action, SDK/schema/endpoint/transport version, observed time, raw response and normalized outcome. Preserve vendor order/execution/trade IDs separately. The exact request association prevents one response being reused across opposite sides, venues or users; no positional fallback.

Each fixture should declare whether it is schema-derived synthetic evidence, a local timeout/error, or an explicitly unsupported/contradictory case. Use exact status enum allowlists; require finite decimal quantity/price with documented units; preserve raw evidence on failure. Valid economic ranges are venue/product-specific and must not be guessed from one generated example. A missing per-fill identity may permit an order-level cumulative observation but cannot be relabelled as a uniquely identified execution event.

M2 can now prepare faithful Kalshi fixed-point and US execution fixtures, plus international acceptance/status-preservation fixtures. Before positive international REST quantity normalization, choose and pin the transport/version/unit contract. None of these mock proofs certify current accounts, attainable fills, exchange eligibility, production database concurrency or live readiness. No new polling/reconciliation service or SDK upgrade is dispatched by this preparation.
