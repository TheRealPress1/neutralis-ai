# Proposed ARB-FILL-1 — bound entry evidence and partial-leg preservation

Planning only, 2026-09-07; root's ARB003 research informs this same proposed checkpoint. This revises
planning commit `8e71af487e8f90ae474feb6c756eccb4fef9b14a`, not M1 source. Founder authorized the
hardening direction; **M2 implementation is not dispatched**. Astra accepted M1 as the completed
offline controls milestone at `2d1bcf6df6286d863e6e789de2cf776b76d9fa71`, parent
`8f0d9359a871870f2f8a51d9718c5c90cf7c0b5b`, preserving exact recovered ad37071 ancestry. Root reports
independent same-family GPT PASS with installed dependencies; this is not a new Fable pass or live
approval. M1 source stays frozen. The next implementation must use that accepted base after Astra
accepts this concrete scope. Sole proposed Python writer remains this lane lead.

Kalshi/Polymarket previously traded per founder. Preserve existing routes/configuration and keys;
no onboarding, SDK migration, account access, daemon, DB application or live enablement is proposed.

## Evidence and explicit source contracts

Astra supplied the independent [response evidence](reviews/arb003-venue-response-contracts.md),
[peer challenge](reviews/arb003-peer-contract-challenge.md) and later
[entry projection clarification](reviews/arb003-entry-projection-clarification.md), preserved here.
The first two reports are verbatim. Their web/installed-SDK
inspection belongs to root's researcher; this lane did not repeat it. Source anchors below refer to
retained candidate01; its adapters/accounting are unchanged in candidate02. The research supports
synthetic fixtures, not deployed compatibility. A TypedDict field is not guaranteed response data.

Each decoder has a fixed contract: operation/endpoint, transport, raw versus SDK-normalized shape,
schema generation, documented quantity/price/currency units, exact status literals and provenance.
Pin relevant schema/type excerpts and hashes in the implementation fixture manifest; the supplied
report does not contain those file hashes. Request context selects an implemented decoder. Arbitrary
caller metadata cannot assert trusted units or make an unsupported shape valid. No magnitude-based
scaling, cross-generation field fallback, substring status match or requested-size/limit-price fill.

| Proposed source boundary | Supported evidence and accounting choice |
|---|---|
| Kalshi raw REST Get Order, existing `GET /portfolio/orders/{order_id}`, OpenAPI 3.29.0 / fixed-point documentation | Cumulative order authority: `fill_count_fp` and complete `maker_fill_cost_dollars` + `taker_fill_cost_dollars`, validated for bound buy outcome and dollar units. Preserve order/client IDs, remaining/initial counts and status separately; order prices are not execution consideration |
| Kalshi raw REST Get Fills, OpenAPI 3.29.0, supplied offline only | Event authority for orders explicitly bound to that contract: `fill_id` (retain legacy `trade_id`), order ID, `count_fp`, documented side-specific execution prices and account context. No new collection method/call; may also supply alternate evidence for cumulative-authority orders |
| US Create Order, Orders API v1.0.0 raw JSON returned by `polymarket-us==0.1.2` `orders.create` | Event authority: exact documented execution enum literals, `executions[].id`, `tradeId`, `lastShares`, `lastPx.value/currency` and order association. Preserve nested `cumQuantity`, `leavesQuantity`, `avgPx` and fees as alternate evidence; do not truncate fractional quantities. NO consideration additionally requires the separate execution-price convention below |
| International `py-clob-client==0.34.6` `post_order` raw JSON | Acceptance/correlation/raw retention only. `success`/`orderID` are not fills; `status=live` with response amounts still creates no inventory. Unsupported status/shape/units produce unresolved observations |
| International current raw REST order/trade schema, raw WS or unified SDK-normalized messages | Separate, non-interchangeable sources. Positive quantity normalization is **UNAVAILABLE** until the endpoint/version/unit mapping is separately evidenced and accepted. Preserve supplied evidence; no trusted-units bypass or automatic SDK upgrade |

The supplied Kalshi fixed-point evidence supports decimal contracts: `"2.50"` means 2.5. Current
Get Order documentation does not automatically validate legacy POST economic fields. An initial
legacy response with unproven economics remains acceptance/unresolved; never promote M1's synthetic
`fill_count`/`fill_price` double to M2 venue truth. Supported snapshots must arrive under the declared
source contract. Legacy submission endpoint availability remains a future rollout verification.

**Conservative challenges retained:** US `avgPx` is not proven lossless cumulative consideration;
use US events for application, never guessed cost from a possibly rounded average. International
REST order fixed-math does not establish legacy SDK trade/allocation units. A manifest label alone
cannot unlock either decoder. Explicit-unavailable outcomes require passing assertions, not xfails.

## Outcome, identity and settlement policy

Internal immutable `RequestBinding` carries user, run, mode, signal/leg/request IDs, venue route,
account/subaccount where supplied, instrument/token, effective outcome/action, submitted amount/unit,
intent and explicit outcomeSide/action fields, request price convention and source contract.
Bind before submission; retain vendor order, execution and trade IDs separately. Validate response
correlation against this original request; context never fabricates execution IDs, price or quantity.
Do not reuse one response across users, venues, opposite outcomes or legs. Preserve recovered
unmatched-leg skipping and orderID custody; remove ticker-only/positional live association.

`OrderOutcome` separates submission acceptance/rejection/unknown, remainder status, observed execution,
settlement state, reconciliation issues and application state. Canceled/rejected remainder cannot
erase executed exposure. Full/partial needs valid quantities/completion evidence, not an ID or status
substring. Parse finite decimals using declared units. Paper remains explicit simulation.

Execution observation and settlement finality are separate. International MATCHED/MINED are provisional,
CONFIRMED denotes successful trade settlement, FAILED failure and RETRYING unresolved under the exact
source enum contract; market payout settlement is separate again. **No international quantity decoder
is supported in this checkpoint**, so even CONFIRMED cannot create inventory without valid economics.
Retain provisional exposure/risk, including `quantity_unknown`; do not report it as zero or settled
inventory. Repeated settlement updates on one trade identity update that observation, not its quantity.
Neither provisional nor absent evidence authorizes a resend/hedge. A later evidenced international
inventory policy requires separate scope acceptance; no provisional-position store is added here.

## Action, unit and entry projection preflight

`TradeSide` only represents BUY_YES/BUY_NO (`neutralis/models.py:47`); the current recorder derives it
from requested `leg.side` (`portfolio/manager.py:100`). A correctly bound execution is not automatically
compatible with this ledger. Add `validate_entry_plan` / `project_confirmed_entry` in the bounded
outcomes module: validate the actual request action, instrument/outcome, submitted units and observed
consideration convention against the existing entry model. Never re-label execution from the desired
signal side. **Preflight every selected leg before ANY route submission**, including a Kalshi-first
maker leg. Known unsupported action/unit/source-projection plans deny the complete selection with
an explicit reason, zero orders and no paper fallback. No scope here for a new short/borrow model.

| Actual route/intent | Proposed entry projection boundary |
|---|---|
| Kalshi supported buy with bound yes/no outcome | Project only source-confirmed contracts and side-correct actual consideration into BUY_YES/BUY_NO; directional exposure alone cannot infer action |
| International current NO path: SELL the YES token, passing `leg_dollars` as SDK SELL `amount` | **Known unsupported before submission.** SELL amount is shares, while the caller supplies dollars; SELL YES is not a funded BUY_NO entry. Deny both maker/taker route directions before the first order. Existing/pending observations stay retained, unapplied and unresolved. A separate request-routing/unit checkpoint must fix and prove this route; this ticket does not change the payload or infer borrowing/inventory |
| US `ORDER_INTENT_BUY_SHORT` or equivalent `outcomeSide=NO`, `action=BUY` | Root's official-source evidence defines buying NO shares; do not classify this as international SELL YES. Quantity/action may bind to BUY_NO, but consideration projection is **UNAVAILABLE until execution `lastPx`/`avgPx` outcome convention is pinned separately**. Known missing price-projection evidence denies new entry plans; already-observed quantities remain visible/unapplied with unknown consideration |

For US, explicit outcomeSide/action takes the vendor-documented precedence over intent when both
are supplied. Bind the effective actual request; contradictory signal/request/response association
remains unresolved, never silently overwritten. Preflight catches known contradictions. The documented
request-price convention is YES/long-side (desired NO $0.83 → request $0.17); it does **not** prove
whether execution lastPx/avgPx is NO cost or its complement. Neither request price nor `1 − lastPx`
may manufacture NO cost basis. Price convention is part of the fixed source decoder, not a trusted
caller flag. US YES positives also require their documented execution-price/currency contract.

If an unsupported execution is already observed, retain its actual action/token/quantity/raw evidence
and mark entry application `not_attempted` with an unresolved projection reason. Halt new continuation;
do not manufacture BUY_NO, discard the execution or claim no exposure. Both request preflight and
post-response projection must run; a passed request check cannot certify malformed later economics.

## One accounting evidence authority per bound order

Choose `execution_events` or `cumulative_quantity_and_consideration` from the supported contract at
order binding, before any application. Keep it fixed for that order/run; **authority switching is out
of scope**, even if another representation arrives first. International has `unsupported`. Alternate
evidence is retained for reconciliation, never another inventory input. Unproven overlap/contract
mismatch stays explicit and stops new entry continuation.

Event authority consumes stable execution IDs scoped to user/account/venue/mode/bound order. Same ID
and identical economics adds nothing; changed quantity, consideration, currency or binding is a
conflict. Settlement-only updates add no execution. Missing identity cannot be replaced with order
ID or guessed venue IDs. A snapshot above applied event totals indicates missing events, not another
ledger input. Later valid primary events can still be received/applied unless storage is uncertain.

Cumulative authority retains **last acknowledged applied quantity AND consideration**. Start from
zero only for a newly bound order with supported complete-from-origin totals; unknown pre-run
application/baselines remain unresolved. Compute `ΔQ = Qnew − Qapplied` and `ΔC = Cnew − Capplied`;
apply a valid positive quantity delta with actual valid consideration delta at `ΔC / ΔQ`. Totals
`2/$0.80 → 5/$2.30 → 5/$2.30` yield `2@$0.40`, `3@$0.50`, then nothing. Never price an increment
at the latest whole-order average or limit price. Advance **both** applied totals only on receipt.

Lower/revised totals, missing cost, unchanged quantity with changed consideration, incompatible
currency/source or identity produce retained reconciliation issues, not negative fills, guessed cost
or clamped deltas. An alternate event after a cumulative baseline does not add quantity even with a
new execution ID; without a covering primary snapshot its application remains unresolved. Preserve
fee evidence separately: missing fees are unknown; rate is not charge; event and cumulative fees are
not additive. Fee correction/rebate application and net P&L remain later scopes.

This is one serial run's consumption rule, not durable idempotency. A fresh process must not infer
that an existing order is unapplied merely because its memory starts empty.

## Observation versus ledger application; partial and late outcomes

Retain each observation under its original binding before attempting entry recording. Application
state is independent of observed execution:

| State | Required meaning |
|---|---|
| `not_attempted` | Evidence retained; no ledger application started. Include reason: alternate authority, unsupported input, pending primary evidence or previous storage halt |
| `applied(receipt)` | Original PortfolioManager entry path completed required existing helper calls and returned a typed receipt identifying binding, applied evidence/delta, trade/position IDs, quantity and consideration. Caller acknowledgement, **not** a PostgreSQL transaction guarantee |
| `unknown` | Attempted application raised, timed out or returned invalid completion. A write may have committed; preserve observation and attempted-write context. Never infer rollback or absent exposure |

Receipts come from the real entry application path; storage doubles provide only external
acknowledgements/failures. Received is distinct from applied. On application-unknown, halt **all new
outbound actions and further accounting writes for the run**, including repeated callbacks. Do not
advance applied totals or label its execution ID successfully applied; retain its association with
the unknown attempt so it cannot trigger an automatic retry. This differs from M1 control revocation,
which still permits original response recording while storage remains trustworthy.

Already-outstanding responses must still reach the original serial collector. Retain raw evidence,
observed exposure and application state: a late leg after storage uncertainty is `not_attempted`,
the earlier attempted leg remains `unknown`. Return an unresolved/incomplete run with both observations
and pending applications, never fully recorded or flat. Bound the collector to admitted requests;
reserve continuation capacity before new requests, denying new work rather than evicting outstanding
evidence. This in-memory result/buffer is neither a second ledger nor a persistent paper store.

Keep timed-out SDK futures attached to original request/collector ownership. Local timeout or blank
order ID is unresolved, not rejection or permission to resend. Late completion enters the original
serial consumer, never a new run/sink. Retain the original recording dependency until pending
continuations drain, or explicitly report outstanding/incomplete work while retaining ownership
in-process. Process death/restart delivery is unproven; no durable queue/recovery daemon is added.

Apply supported observations before attempting another entry leg. **Halt further entry legs after
partial, pending, unsupported or unknown outcome.** Remove the requested-dollar partial hedge fraction;
report residual exposure instead of automatic hedge/unwind. Existing bounded status/cancel handling
for the original order may continue only with valid source/identity and M1 controls, never after
application uncertainty; no new reconciliation poller. Depth/cancel/error early returns must preserve
observed fills. Full continuation needs supported complete evidence, application receipt, M1 permission,
existing depth checks and a verified supplied unit/payoff relation. Apply the explicit action/unit/
price projection preflight above, including US BUY_SHORT's distinct buying-NO meaning. No routing
change, short-position accounting or exits are included.

## Exact proposed files and source anchors

Anchors are at candidate01; use accepted candidate02 as the future code base.

- `neutralis/execution/models.py`: immutable binding, source/outcome, authority and application
  receipt/state types beside existing simulation models; no live defaults.
- `neutralis/execution/outcomes.py` (one small new module): source-specific validation, whole-route
  `validate_entry_plan`, `project_confirmed_entry`, fixed-order authority, serial observation
  consumption and pending-continuation ownership. No engine, service
  registry, discovery, persistent store or storage adapter.
- `neutralis/execution/kalshi.py`, `polymarket.py`, **`polymarket_us.py`**: retain raw responses/bindings,
  supported decoding and original futures. US `_normalize_result:126` drops details/accepts IDs;
  international `:240,315` drops future ownership after timeout; Kalshi `:186,242` returns legacy POST /
  lookup objects. Cover affected market/limit/cancel/close-result delivery; no new endpoint, credentials
  redesign, SDK upgrade or exit accounting. Close acknowledgement cannot create an entry/exit fill.
- `neutralis/portfolio/manager.py`: only live `record_fill:68`, matching `:27` and entry
  `_upsert_position:171` inputs/receipt completion. Remove requested quantity/price fallbacks at
  `:113–147`, apply bound economics, return acknowledgements after existing trade/position calls at
  `:155–156`. Preserve paper simulation. Decimal validation/deltas precede the existing storage
  boundary; unsupported precision stays explicit, never silently truncated to requested size.
- `neutralis/engine/event_loop.py`, `scripts/run_once.py`: existing entry/result/ownership paths only.
  Kalshi-only (`event:2045`, `polling:1094`), international taker/maker (`event:2301,2427`), US
  cross-platform (`event:2088`) and polling directional context omissions (`polling:660,703`): retain
  observations across depth/cancel/error returns, apply partial halt/application states.
- Tests: `tests/arbitrage/test_outcomes.py`, `test_partial_outcomes.py`, `test_outcome_replay.py`,
  `tests/arbitrage/fixtures/outcomes/` manifest/synthetic inputs, affected focused doubles/assertions,
  `tests/test_portfolio_manager.py`; `docs/arbitrage/` evidence. Positive tests retain real preparation,
  dispatch, permission gates, adapter payload/response handling and PortfolioManager, doubling only
  external dependencies at existing seams.

No product/config/schema/test fixture changed in this planning turn. Any required mode-policy,
wrapper, persistence, scanner, routing or generic model change returns to Astra for scope closure.
Existing helpers `storage/postgres.py:384,420` commit separately; no in-memory receipt can certify
atomic persistence or database numeric behavior. Do not change those helpers in this checkpoint.

## Mandatory offline fixtures and acceptance

1. Source manifest and faithful synthetic Kalshi fixed-point order/fill and US execution JSON:
   operation/transport/schema/package provenance, exact enum literals/units and expected outcomes.
   International fixtures cover acceptance/unsupported/status retention. Same numeric string under
   supported versus unknown contracts cannot imply the same quantity; unified SDK-shaped input
   fails the legacy raw decoder. Include missing/malformed/non-finite economics, ID-only acceptance,
   resting amounts, cancel/reject with observed fills, Kalshi `2.50` and US `0.25`. No M1 `fill_price`
   double reused as venue proof. No unsupported outcome creates requested-size inventory.
2. Real plan preflight → adapter normalization → original event/polling dispatch → PortfolioManager
   with external doubles: supported full/partial buys retain actual action/units, identity, quantity
   and consideration. International SELL-YES-as-NO and dollar-as-share plans deny the entire selected
   route before first order, including Kalshi-first maker. Independently supply already-outstanding
   unsupported responses through original continuations: preserve exposure, no false BUY_NO write.
   US BUY_SHORT binds to buying NO, not SELL YES; test outcomeSide/action precedence and contradictory
   bindings. NO $0.83/request $0.17 alone must not unlock NO execution-cost projection. Missing
   lastPx/avgPx convention denies new plans and leaves observed quantity unapplied/consideration
   unknown. Any future positive NO-price fixture needs separately pinned execution evidence. Trade
   settlement updates add no inventory; provisional/unknown exposure is visible, not a zero position.
3. Replay `snapshot 2/$0.80 → event 2@$0.40 → snapshot 5/$2.30 → event 3@$0.50 → same snapshot`
   under both fixed authorities: final five contracts/$2.30, not ten/twelve. Alternate observations
   remain available; missing-primary intervals are explicit. Test lower/out-of-order/revised totals,
   missing consideration, changed-economic duplicate IDs and a new alternate event after cumulative
   baseline without covering snapshot: no extra entry. Both applied totals move only on receipt.
4. Different users/accounts/modes/venues/tokens/opposite outcomes, reordered events and multiple events
   per leg obey binding/authority. Deterministic fresh-run replay uses a fresh isolated sink; it does
   not prove deduplication against an existing DB or across restarted runs.
5. Parameterize actual Kalshi-only, international maker/taker, US cross-platform and polling
   directional completion: observed first leg then depth denial/rejection/timeout, cancel error or
   racing additional execution, and revocation before response. Preserve original observations;
   apply supported entries when storage is trustworthy. Partial/unknown halts additional entry legs;
   Known-unsupported routes exercise zero-order preflight; do not bypass it to manufacture a positive
   international entry test. Continuation tests use supported admitted plans with later incomplete/
   contradictory responses, or previously outstanding observations supplied to the bound collector.
   Replaying such evidence never replays submission. International observations remain unresolved.
   No paper fallback, blind resend or unwind.
6. Storage double records A then raises between existing writes; already-submitted B completes late
   through its real adapter future/response path. Assert A observed/application-unknown, B observed/
   not-attempted, both original raw bindings retained, unresolved run, no further outbound or write.
   Repeated A callback must not retry. Hold/release external futures to prove original continuation
   and sink lifetime; do not mock the production response handler or claim rollback.
7. Entry cost control: `3@$0.40 + 2@$0.50 = 5 contracts/$2.20`, VWAP $0.44. Fees remain observed/
   unknown separately; no net-P&L claim. Re-run accepted M1 proofs and affected inspected regressions
   at the committed candidate, documenting superseded guessed-fill assertions. No required skip/xfail.
   Attribute installed-dependency results and the historical directional duplicate-position issue
   separately; neither a same-family review nor mocks certify deployed operation.

Later checkpoints own durable PostgreSQL identity/atomic writes/mode uniqueness, fee/cost-basis
corrections and primary schedules, actual exits/market settlement, durable replay/recovery and residual
hedge/unwind. Kalshi primary fee evidence remains UNAVAILABLE. No migration/backfill/application,
historic correctness, production concurrency, restart deduplication or live-readiness claim here.
Stop after this exact proposal is committed/exported for Astra's acceptance. No M2 code follows
without that concrete dispatch, and M1's acceptance authorizes no rollout.
