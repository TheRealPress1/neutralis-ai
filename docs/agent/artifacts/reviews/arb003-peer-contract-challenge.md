# ARB003 peer challenge — three contract decisions before acceptance

Prepared 2026-09-07. This challenges the builder summary supplied by Astra, not the unreceived full proposal or an implementation. Basis: `docs/agent/tasks/ARB003-fill-accounting-plan.md`, the independently prepared response contracts, and source inspected at `8f0d9359a871870f2f8a51d9718c5c90cf7c0b5b` in `.context/arb002-review-c01`. M1 revision acceptance remains a prerequisite. No code edits, tests, dependency changes or new API calls were made for this challenge.

The proposed checkpoint is useful and can remain bounded. Three unresolved choices could otherwise produce another false success claim despite stronger types and fixtures.

## 1. A version-labelled international fixture can still invent confirmed quantity

**Risk.** The installed `py-clob-client==0.34.6` returns JSON without normalizing its quantities (`client.py:623`, `http_helpers/helpers.py:60`). Current official REST documentation specifies six-decimal fixed math for order sizes, while raw WebSocket examples use human-readable quantity strings. REST trade `size` and maker `matched_amount` descriptions do not establish that same scale. Current docs also cover newer SDK/API generations. The current adapter's `success=True` is merely submission processing evidence (`neutralis/execution/polymarket.py:254`). Attaching a manifest saying “SDK 0.34.6 + current docs” does not resolve a version or unit mismatch. A payload value `"1000000"` cannot safely select its own scale by magnitude.

There is a second distinction within this same contract: a matched international trade is not finalized settlement. A normalizer must not silently map both to one confirmed/full state.

**Smallest resolution.** Name a supported source contract per decoder: endpoint/transport, raw versus SDK-normalized shape, documented units, status enum and evidence provenance. Unsupported international submission/trade shapes remain acceptance or unresolved observations with preserved raw data; they cannot create a requested-size entry. Do not add a synthetic “trusted units” switch that bypasses the real decoder. If exact positive REST-fill support cannot be established before M2, explicitly scope international M2 to acceptance, correlation, raw-evidence retention and unresolved-state handling. Positive international quantity normalization then awaits a separately evidenced contract; no automatic SDK upgrade or account call is needed now.

Define execution observation and settlement state separately. Matched/mined evidence may establish provisional exposure that must remain visible, while final settlement stays unconfirmed. Neither provisional status nor absent evidence authorizes resubmission or an automatic hedge.

**Acceptance example.** The same numeric string arriving under supported versus unknown source contracts must not yield the same confirmed quantity by assumption. An ID-only or `status=live` response yields no booked fill. Repeated status updates on one trade ID do not multiply quantity. A fixture from the current normalized SDK must fail the legacy raw-REST decoder rather than quietly passing as compatible.

Evidence: [response-contract preparation](arb003-venue-response-contracts.md); official links retained there to [REST schema](https://docs.polymarket.com/api-spec/clob-openapi.yaml), [raw/normalized stream examples](https://docs.polymarket.com/trading/realtime-order-updates), and [order/trade lifecycle](https://docs.polymarket.com/concepts/order-lifecycle).

## 2. Deduplicating event IDs does not prevent cumulative/event overlap

**Risk.** “Execution events versus cumulative 2 → 5 → 5” leaves their interaction undefined. Example: a cumulative order snapshot reports two executed contracts; later an individually identified execution for those same two contracts arrives. Both are valid evidence, but neither shares the same event ID. A per-run event-ID set plus cumulative high-water mark can still book four. Quantity-only delta logic also invents execution price when later fills occur at a different price.

Polymarket US exposes incremental `lastShares`/`lastPx` beside cumulative `order.cumQuantity`/`avgPx`; Kalshi exposes cumulative filled quantity and maker/taker consideration totals. The source currently substitutes order limit prices, so merely fixing quantity does not establish actual cost (`neutralis/portfolio/manager.py:130`).

**Smallest resolution.** For this checkpoint, select one **accounting authority per bound order** within a run and keep it fixed: individual execution events or validated cumulative quantity-and-consideration snapshots. The other view is retained for reconciliation and must not independently mutate inventory. Switching authority requires explicit proven coverage; without it, report accounting unresolved and stop continuation. Do not discard additional evidence simply because its representation cannot yet be applied.

In cumulative mode, maintain previously applied quantity and consideration together. New delta is their difference; duplicate snapshots add nothing. Derive a delta price only from a documented valid consideration delta and quantity delta, never the order limit or the latest average applied to the whole increment. A lower/revised total, mismatched identity, unavailable consideration or incompatible source contract produces a retained reconciliation issue, not an automatic negative fill or clamped zero. Fees can remain separately unknown/preserved for the later fee checkpoint.

In event mode, stable execution identity is scoped to the bound order/account/venue/mode; duplicate observations with changed economic fields are conflicts, not harmless duplicates. Aggregate snapshots that exceed applied event totals indicate missing evidence, even when they are not another ledger input.

**Acceptance examples.** Test snapshot 2 → event 2 → snapshot 5 → event 3 → snapshot 5 in both authority modes; never book ten or twelve. For cumulative consideration `$0.80 → $2.30`, the incremental fills are 2 at $0.40 and 3 at $0.50, not 3 at the new overall average. Also test out-of-order snapshots, a conflicting replay of one execution ID, and a new event after a cumulative baseline without proven overlap. The final case must remain visibly unresolved if the chosen authority cannot safely account for it.

## 3. “Storage uncertainty halts continuation” must preserve late responses and distinguish observation from application

**Risk.** Existing storage helpers commit separately (`neutralis/storage/postgres.py`, independently committing helpers; see the root continuation plan). A write may succeed and then raise or time out before acknowledgement. Retrying it can duplicate accounting; marking an in-memory execution ID applied before acknowledgement can suppress a necessary record. Conversely, an early halt can discard a second already-outstanding response, reproducing the partial-response loss currently being fixed in M1. A run-local dedup promise does not make this durable or safe across restarted runs.

**Smallest resolution.** Give an outcome two separate facts: **observed execution** and **accounting application state** (`not_attempted`, `applied` with a receipt, or `unknown`). A persistence exception after an attempted write yields application-unknown; do not blindly retry or declare the leg absent. Retain the original raw observation and original identity in the existing run's bounded evidence buffer/result. Stop new outbound actions and accounting writes after uncertainty, while still accepting already-outstanding callbacks into that buffer. A late confirmed execution must remain observable even if its ledger application cannot proceed.

The run must finish as unresolved/incomplete with exposure evidence and pending application details, never “fully recorded” or a nominal zero position. The ticket should explicitly deny durable dedup, replay-after-restart guarantees and production/live enablement until the atomic persistence checkpoint. No competing ledger or recovery daemon is needed for M2; reuse its existing sink abstraction and return typed application receipts in offline doubles.

**Acceptance example.** A storage double records leg A and then raises. Leg B's already-submitted response arrives after the halt. Assert: no resubmission/hedge/new outbound action, no automatic retry of A's uncertain write, both observations retained under their original bindings, A application-unknown, B not-attempted, and run unresolved. Repeat A's callback within the same run without attempting another write. A new run must not be advertised as deduplicated by the old run's memory.

## Recommendation

Accept the next checkpoint only after the full builder proposal names these three policies and their actual runtime acceptance paths. Preserve the useful narrow scope: truthful entry observations, exact binding, partial-leg retention and bounded run-local application. Defer durable ledger guarantees, schema deployment, fee calculation, exits and automatic recovery as already planned. This is a contract clarification request, not a rejection of the checkpoint or a competing dispatch.
