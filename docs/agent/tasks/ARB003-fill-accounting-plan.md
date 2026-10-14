# Arbitrage fill/accounting continuation — scoped planning

Prepared 2026-09-07 after Constantine confirmed building the identified arbitrage changes. The founder also confirms Kalshi and Polymarket were already connected and actually traded. This is hardening the existing system; it does not require new venue onboarding or replacement keys. Current deployed SHA, runtime activity, balances and credential validity remain unverified.

Current amendment: M1 is accepted at `2d1bcf6`. The first continuation below has become the exact accepted [ARB003 / ARB-FILL-1 ticket](ARB003-bound-entry-outcomes.md), proposal4200134, and is dispatched to the same owner. Its explicit partial-outcome halt replaces the earlier broad suggestion below to calculate an automatic remaining hedge. Durable application, fees and exits remain subsequent checkpoints; the historical planning/undispatched statements below do not override the accepted ticket.

M1 is already dispatched to the sole GPT Ultra Python owner. This document orders subsequent work; it does not launch another writer or add accounting changes to M1. Base the next code milestone on the independently reviewed M1 candidate, preserving recovered `ad37071` ancestry. Finalize each checkpoint's files, acceptance and boundaries with that owner before implementation. Live orders, production database application/repair and rollout remain outside the current offline scope.

Source inspection by independent `/root/arb_contract_check` verified the clean recovered audit worktree at `ad37071ae6bbc4a31289f9e662388c50e92ac3d3`, parent `d524b5a75643df5f508c068e3c4fb930ba54b4eb`, tree `e83cb4b7f5c91396ca58bbcb19e8e2e25e54d057`. The following line anchors refer to that source, not a future M1 layout.

## First continuation: confirmed outcomes and partial-leg preservation

Define distinct submission acceptance, pending/unknown outcome, confirmed partial/full execution and rejection/cancellation states. Retain original user/run/request/leg, venue, instrument/token, outcome side, buy/sell action, order identity, stable execution identity where supplied, confirmed quantity, actual price and raw evidence. A submission ID or requested quantity must not create a confirmed position. Missing evidence is unknown, not a guessed fill or rejection. Normalize only documented/source-supported fields; no invented venue response schema.

Source anchors: `neutralis/execution/polymarket_us.py:109` normalizes away detail and treats order ID as success; `neutralis/portfolio/manager.py:27` and `:118` match ticker/optional venue and can substitute requested quantity/price; `scripts/run_once.py:697` includes directional results that omit ticker. Preserve recovered no-positional-fallback behavior and prevent one response being reused across opposite sides.

Retain/apply every observed confirmed leg even if a later leg fails, depth disappears, a cancellation errors or M1 permission is revoked. A timeout after submit remains unresolved until reconciled; it does not authorize blind resubmission. Use confirmed contract exposure for remaining hedge quantities, not one global requested-dollar fill fraction. Preserve the outstanding-response continuation already required by M1.

Source anchors: `neutralis/engine/event_loop.py:2038` (Kalshi-only return), `:2312` (post-Polymarket depth failure), `:2463` (maker cancellation), and `scripts/run_once.py:1129` (all-filled partial suppression). The next bounded code ticket should choose an explicit outcome contract and wire these real paths with synthetic response/market inputs, without adding automatic live unwind or a second engine.

## Durable application and mode isolation

Distinguish unique execution events from cumulative quantity snapshots; repeated evidence must not duplicate quantity, trades or fees. Evidence, order status and position/trade mutation need an atomic persistence contract, scoped by user, venue and mode. Extend existing order/fill storage rather than creating a competing ledger.

Durable guarantees require schema work: `migrations/023_multi_tenant.sql:20` has the open-position uniqueness without `is_paper`; `migrations/010_execution.sql:31` shows order/fill identity constraints; `neutralis/storage/postgres.py:385` starts independently committing helpers. Prepare versioned migration files and compatibility/rollout documentation in a separately bounded checkpoint. Do not apply migrations or backfill old records. Mock storage verifies application semantics, not production PostgreSQL concurrency or historic correctness.

[Later dependency map](../ARB-DURABLE-DEPENDENCIES.md) inspects accepted M1's actual helpers, local-versus-venue identities, tenant sources, mode-blind constraints and transaction/race requirements. It is read-only preparation for a future ticket based on the eventual accepted ARB-FILL-1 types; no storage/schema implementation or database test stage has been dispatched.

## Fees, exits and replay

Carry actual charged fees separately from estimated schedule fees and platform performance fees. Unknown fees stay explicit. Derive consideration and cost basis from confirmed fills, allocate basis and fees on partial exits, and avoid double deduction. Supplied versioned fee schedules must identify venue/series/effective time and rounding; hard-coded coefficients are not proof of current fees. Source anchors: `neutralis/portfolio/manager.py:246`, `neutralis/execution/executor.py:124`, `neutralis/fees/exchange.py:14`.

Separate exit intent, accepted exit request, confirmed partial/full sale and final settlement evidence. `neutralis/portfolio/manager.py:758` currently closes bookkeeping at a supplied bid. An acknowledgement must not flatten exposure or realize P&L; confirmed partial exits reduce only their executed quantity. Automatic live unwind and recovery actions need their own scoped implementation and rollout evidence.

Replay frozen synthetic market/response/fee sequences through the real normalization, orchestration and ledger paths. Recorded venue fixtures can follow under a separately verified read-only collection scope. Offline replay correctness does not establish attainable arbitrage returns or current venue eligibility.

## Minimum meaningful examples

- Accepted ID with no fill; missing/malformed price or quantity; valid full and partial fills.
- Same ticker on different venues/opposite outcomes; reordered results; duplicate execution IDs; cumulative fills `2 → 5 → 5`.
- First leg filled followed by depth denial, rejection or timeout; cancellation racing a further fill; controls revoked before an outstanding response returns.
- Same instrument across users and paper/live modes; storage failure between logical writes; deterministic replay without duplicate application.
- Known ledger: buys `3 × $0.40 + 2 × $0.50`, total fees `$0.05`, settlement `$5.00` imply net P&L `$2.75`; partial exits preserve remaining basis.
- Missing fee schedule, rounding boundary, corrected fee and exit acknowledgement without execution.

No real API credentials are needed for these synthetic proofs. Production access already existed according to the founder; verify and preserve its configuration when a future rollout is concretely prepared.

## Planning evidence and peer challenge

The existing owner committed `ARB-FILL-1-proposed-checkpoint.md` in its planning branch at `8e71af487e8f90ae474feb6c756eccb4fef9b14a`. This is a proposal summary, not an accepted implementation. Its complete text is requested for root reconciliation. M1 candidate02 review remains a prerequisite.

[Current response-contract evidence](../ARB003-VENUE-RESPONSE-CONTRACTS.md) provides documented Kalshi fractional fields and US execution-event fields, and identifies unresolved international transport/version/unit boundaries. Independent summary-level peer challenge requires: one source-supported decoder contract; one accounting evidence authority per order so cumulative snapshots cannot overlap execution events; and a separate application state for observed executions when storage acknowledgement is uncertain. Pending/late responses must remain visible after halting continuation.

Root sent the full evidence and peer challenge to the same owner for planning after the M1 revision freezes: message `b43094a3-ab44-437b-9e60-9b38ff48a66d`, receipt `.context/arb003-contract-evidence-planning-receipt.json`. No M2 source implementation, SDK upgrade, account call, durable ledger guarantee or production application is authorized by that planning message.
