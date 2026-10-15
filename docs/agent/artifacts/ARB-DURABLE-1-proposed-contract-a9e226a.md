# ARB004 / ARB-DURABLE-1 — durable entry application and mode isolation

**Proposed contract, documentation only; no implementation or database stage dispatched.**
Prepared against accepted ARB003 `edbe260cbd65313385e12fac212f9a1cbf50c8a0` on 2026-09-07.
Astra must review this complete artifact before assigning a bounded code or database ticket.
The existing sole arbitrage owner would implement it; no second writer, engine, ledger or daemon.
This hardens integrations that previously traded per Constantine. Production schema, accounts,
deployed commit/process and database version remain unverified. No production access is needed here.

## 1. Result and current source boundary

Persist supported entry evidence and its acquisition effects under one database acknowledgement,
with replay decided from durable identity and exact stored totals. Separate admission, attempted
submission, observed execution and committed economic application. Neither an order ID, caller delta,
empty process memory nor a successful individual helper establishes a durable acquisition.

All anchors below are at the accepted head above; they supersede the historical M1 map.

| Current source | Consequence for this proposal |
|---|---|
| `neutralis/execution/models.py:132`, `:168`, `:198`, `:207` | RequestBinding has original scope and optional account; ExecutionEvidence has source/event or cumulative economics; EntryProjection is a run-local delta; EntryReceipt is a helper acknowledgement, with no durable application key or commit evidence. |
| `neutralis/execution/outcomes.py:395`, `:426`, `:528`, `:554` | Admission, event identities, Q/C watermarks and callback ownership are currently in memory. Existing-order baselines are unavailable. Application uncertainty stops outbound work while preserving late observations. |
| `neutralis/execution/outcomes.py:77`, `:161`, `:576`, `:601` | Accepted whole-plan unit checks, source decoding, original-quantity completion and immutable request construction must survive. Random request IDs become durable only if stored before submission. |
| `neutralis/portfolio/manager.py:131`, `:137`, `:180`, `:185` | Current live entry verifies the actual user-stamping dependency, exact leg, supported economics and float representation; then save_trade and position helpers acknowledge separately. Confirmed additions already bypass old rounding; lines219–246 are the other path, not the new live implementation. |
| `neutralis/storage/postgres.py:36`, `:41`, `:68`, `:384`, `:423`, `:471` | Connection setup ends in non-autocommit mode; _ensure_connected may reconnect; entry helpers commit separately. A wrapper around those public helpers cannot own one atomic transaction. |
| `neutralis/storage/postgres.py:1186`, `:1244`, `:1281`, `:1324` | Order conflict returns an empty ID; fill insertion, aggregates and fill/trade linkage commit independently. Order/fill user comes from the object; trade/position user comes from storage._user_id. |
| `neutralis/storage/postgres.py:573`, `:597`, `:1350` | Open-position lookup can filter mode, but ID lookups/link updates lack complete scope. New entry operations must enforce scope themselves; no deployed RLS assumption. |
| `migrations/010_execution.sql:4`, `:31`, `:43`, `:66` | orders.id is local; fills.order_id references it; trades.order_id is free text currently holding the venue ID. Tick/decision/ticker/side uniqueness is not event identity. Fills require economic fields and default fees to zero. |
| `migrations/003_portfolio.sql:5`, `:28`; `023_multi_tenant.sql:5`, `:20`; `026_positions_is_paper.sql:2` | Economic fields are double precision; legacy users may be null. Open-position uniqueness omits mode. Historical mode backfill lacks user/lifecycle boundaries and must not be rerun or trusted as provenance. |
| `neutralis/execution/mode.py:158`, `:243`, `:306`; `neutralis/engine/event_loop.py:2019`; `scripts/run_once.py:744` | Paper uses SimulationSink. stop_outbound deliberately leaves original recording open. Both real entry dispatchers already bind/record/complete through the shared boundaries. |

The local migration inventory ends at026, with some earlier duplicate numeric prefixes. Reserve
`migrations/027_durable_entry_application.sql` for a future accepted ticket, contingent on rechecking
the then-current inventory. Do not edit, replay or repair010/023/026. Local inventory does not prove
deployed schema. The new migration must assert exact expected predecessor objects or abort.

## 2. Typed boundary: durable facts, not caller deltas

Add the following frozen types beside the accepted entry models. These are proposed interfaces,
not present code. Decimal fields carry Decimal, not floats or numeric JSON guesses.

| Type / method | Required input and returned fact |
|---|---|
| `DurableAccountScope` | Nonzero user UUID, venue, opaque external account namespace, explicit subaccount value or documented not-applicable, and a provenance reference. Supplied by the original recording dependency, independently of response data. Unknown is a distinct unavailable state. |
| `DurablePlanIntent` | Whole selected tuple of original bindings, persisted signal/decision IDs, original tick/run, immutable request payload semantics, account scopes and equal-unit selection relation. No applied baseline, claimed fill or generated Trade. |
| `PostgresStorage.admit_entry_plan(intent)` | Revalidate supported plan, dependency scope and existing signal/decision ownership; atomically insert all new order intents or resolve identical existing intents. Return `DurableAdmission` per local order only after commit acknowledgement. |
| `mark_entry_submission_started(admission)` | Atomically advance exactly one admitted order to submission_started once, before its first adapter call. Return a one-use start acknowledgement. Existing/uncertain start never authorizes another submit. |
| `DurableObservationInput` | Local order ID and admission fingerprint; original serialized AdapterReply body/source/local error type and observed time. No Future/client/headers/credentials. Original binding and authority are loaded from the admitted order; a supplied binding is only a consistency check. No caller Q/C delta is accepted. |
| `apply_entry_observation(input)` | Re-decode raw input with the accepted fixed source decoder and persisted original binding, validate scope/projection, lock durable progress and derive eligible deltas from stored state. One transaction for one bound order observation; a US response with multiple primary events may produce multiple acquisitions within that transaction. |
| `DurableApplyResult` | Observation key and persistence acknowledgement; disposition committed_new / committed_repeat / observed_only / rejected_before_attempt / unknown; zero or more `DurableEntryReceipt`s; current acknowledged order Q/C/revision and unresolved issues. It never equates observed_only with zero exposure. |
| `DurableEntryReceipt` | Protocol version, local order/fill/trade/position IDs, external order ID, full scope, deterministic application key and economic fingerprint, that application's exact delta Q/C/currency, and order/position revision after it. Issued only after top-level commit acknowledgement, or recovered by a validated committed lookup. It is distinct from current EntryReceipt. |
| `reconcile_entry_application(scope, local_order_id, application_key, attempt)` | Finite database-only lookup using original identity and a fresh explicitly owned connection. Return committed receipt, proven_not_committed or unresolved. No venue lookup, resubmit or automatic application retry. |

PortfolioManager remains the entry facade: `prepare_durable_entries` performs its existing
signal/decision/leg/user validation and admission; `record_entry_observation` delegates to the
owned storage boundary. Storage repeats critical checks rather than trusting the facade. It
reconstructs supported evidence and computes deltas; EntryProjection may remain a diagnostic
comparison but is not a storage input authorizing economics. No path may fall back to the old
independently committing live helpers when durable admission/application is unavailable.

The original prepared storage factory may supply an immutable per-venue DurableAccountScope and
a dedicated connection factory to PostgresStorage. No configuration file, credential record,
ApiKeyManager or key registration changes. Missing scope denies new live entry before either leg.
Preparation may attach the supplied account/subaccount to a binding before it is durably admitted;
after admission those fields are immutable. A conflicting non-null binding is rejected. The scope
is an external dependency with explicit provenance, not a caller boolean declaring an account safe.
This ticket does not establish actual production account ownership; offline fixtures supply it.

Preserve supported Kalshi acquisitions and US YES events. International positive quantities,
international SELL-YES-as-NO/dollars-as-shares and US NO execution consideration remain unavailable.
Unsupported known plans create **no intent or economic rows and send no order**. Unsupported late
evidence for an already admitted order may be retained as an observation, never as a fill/trade.
Current source enums are allowlisted; payload values or a caller's units flag cannot unlock a decoder.

## 3. Identity, admission and crash windows

`entry_scope` is a canonical versioned JSON object containing nonzero user UUID, venue, account
namespace, tagged subaccount, mode, ticker, instrument, outcome and actual action. Its exact schema,
field names and canonical encoding are fixed in models/storage, with no unknown fields. Use tagged
`{kind: id, value: ...}` versus `{kind: not_applicable}` subaccount states; null does not mean zero.
Unknown account/subaccount is unavailable. Bound strings are nonempty and canonical serialized scope
is limited to1536 UTF-8 bytes; oversize identities are denied without truncation. A hash accelerates
comparison only; stored canonical content must also match. Mode maps explicitly to existing is_paper.

Use the existing orders table, with local ID `entry:<full original request UUID hex>`. Persist the
entire original run/request/signal/decision/leg, amount/unit, action/instrument, request price
convention and actual client_order_id. Run/request IDs were ephemeral at ARB003; their originals
become durable at admission. Restart must load that admission by original local ID or scoped venue
order identity, not call bind_entry_plan to invent a replacement. The newly executing process/run
is delivery provenance only and must not overwrite the original binding.

Venue order identity is nullable until observed, then immutable and unique within
user/account/subaccount/venue/mode. Local order ID and venue order ID remain separate. Kalshi's
existing client order ID is retained; it is not a fill ID. No new US idempotency field or SDK payload
is added. US lost acceptance with no venue ID remains unresolved. Original callbacks can still
bind a late ID using their durable admission; unknown old responses cannot adopt an order by ticker.

Authority is selected and persisted at admission: Kalshi order snapshots=cumulative; supported US
executions=events; supported supplied Kalshi fill evidence=events only when that authority was
explicitly admitted. No new fill-list transport is added. The initial durable Q=C=0 is legitimate
only for a newly committed, not-yet-submitted intent. No legacy order can acquire a zero baseline.
Existing order admission must compare every immutable field and return its stored progress.

Admission and submission_started are separate transactions. Admit the complete selected route
before any submission. Immediately before each adapter mutation: require original admission/start
acknowledgements and the existing exact-user controls. No venue work occurs under a database lock.
An ID/start acknowledgement is not permission to resend after restart.

| Crash/uncertainty window | Preserved fact and allowed result |
|---|---|
| Before admission commits | No durable intent proven; no submit. Resolve an ambiguous admission using the original request IDs, never new ones. |
| Admission committed, no start recorded | Intent exists, zero economic baseline. Restart reconciliation may report not_started; this checkpoint never automatically submits it. |
| Start committed, before/during adapter call | Submission may or may not have reached venue. Keep submission_started/unresolved; never infer no order from absent fill. |
| Venue response received, before observation commit | Raw evidence remains in the original process collector. A crash can lose it; durable intent marks unresolved work. No claimed delivery/recovery guarantee or new collector daemon. |
| Application writes begun, before commit | Acknowledged rollback means this transaction applied no economics; connection/commit uncertainty is unknown. Do not advance process baselines. |
| Commit succeeded, acknowledgement lost | Reconcile the deterministic identity and original scope; never blindly retry writes, switch authority or submit an order. |
| Late pre-restart response | Accept only under the original durable admission and matching original recording user/account. Explicit replay uses that binding; the new delivery run is not an owner substitution. |

Unrelated future signals may not be mistaken for restarted requests. Persisted signal/decision
IDs and the original request key provide admission replay identity; this is not a new global
strategy deduplication rule or a promise to identify every economically similar decision.
For an event entry without a tick identifier, use an explicit `entry:<original run_id>` provenance
tag in orders.tick_id; it is not a market tick or an economic deduplication key. Persist the exact
submission descriptor (including the existing rounded/clamped Kalshi limit) and compare actual
adapter call arguments against it before marking start. No copied reference quote becomes an
execution price, and no payload/routing semantics change.

## 4. Authority and application rules

Persist raw observations on `orders.entry_observations` as a keyed JSONB object, separate from
economic fills. Each record contains source, raw body, original observed time, local timeout/error
state, normalized outcome/issues, alternate views and application keys. No credentials/headers or
SDK objects. Observation key is SHA256 of protocol/source/local-state/canonical raw body; receipt
time is excluded. Preserve distinct conflicting bodies under distinct keys. Canonical decimal
strings normalize numerical equality without changing source raw strings. Existing JSON values
are never overwritten with contradictory evidence.

Bound retention: at most256 distinct observations and1MiB canonical raw data per order in this
checkpoint; identical repeats add no record. An oversized response/capacity limit returns
unavailable, stops new entry and remains in its original in-memory collector; no eviction, fake
durable acknowledgement or economic write. Admit all outstanding callback slots under ARB003.
This explicit storage limit does not promise durable capture of arbitrary venue streams.

**Event authority:** deterministic application key hashes protocol, local order, source contract
and execution ID in an unambiguous canonical tuple; store all components alongside it. A repeated event with identical scoped identity,
quantity, consideration and currency resolves to its existing fill/trade receipt. A changed economic
fingerprint, instrument/action or external order association is a retained conflict with no second
application. Preserve execution and trade IDs separately; never assume trade ID is globally unique.
Fee-only/status changes remain alternate reconciliation evidence, not extra quantity or zero fees.

**Cumulative authority:** key the application by original order/source and canonical cumulative Q/C.
Under the locked order compare both to the acknowledged durable totals: new delta is
`(Qnew − Qapplied, Cnew − Capplied)`. Require positive delta quantity, nonnegative supported cost,
valid acquisition economics and original request bounds. Example2/$0.80 then5/$2.30 gives
2/$0.80 and3/$1.50; it does not multiply the latest average by three. Repeating a previously applied
snapshot returns that receipt without adding its historical delta again. A lower snapshot without
a matching committed application, unchanged Q with changed C, or missing/invalid consideration is
reconciliation-required, not a negative/clamped fill. Both Q and C advance in the same transaction.

**One authority:** alternate event/snapshot views are retained in the order observation object and
never independently mutate economics. In cumulative mode, an event arriving after a baseline does
not prove overlap merely because it fits below total Q/C. In event mode, cumulative totals exceeding
applied events expose missing coverage. Persist these issues and halt continuation as in ARB003;
no automatic authority switch or arbitrary coverage flag. Concurrent/restarted replays use the
same locked state and identity comparisons, not the old process's set/dictionary.

All supportable deltas in one order response commit together. Each newly applied primary event or
cumulative increment produces one fill, one trade and one position increment. Distinct events
remain distinct even in the same response. Conflicting/unsupported observations are not transformed
into acquisitions; legitimate evidence in the response remains observed, with explicitly retained
issues. Partial/conflicting completion may still record supportable exposure, never revive a
halted route. No receipt certifies completed original quantity unless ARB003's full gate also passes.

## 5. Small versioned schema, explicit compatibility break

Propose additive nullable columns on the existing four tables, plus narrowly scoped constraints and
write guards in027. No fifth ledger table and no general float-to-numeric rewrite. `entry_version=1`
identifies new protocol rows; NULL identifies untouched legacy rows, not verified ownership/mode.

| Table | Proposed additions / exact meaning |
|---|---|
| orders | `entry_version SMALLINT`, `entry_scope JSONB`, `entry_binding JSONB` (full immutable intent, original IDs, authority/source and provenance), `venue_order_id TEXT`, `entry_state TEXT` (admitted/submission_started/observed), `entry_started_at TIMESTAMPTZ`, `entry_observations JSONB`, `entry_halt_reasons JSONB`, `entry_revision BIGINT`, `entry_applied_quantity NUMERIC(28,8)`, `entry_applied_consideration NUMERIC(38,16)`. Existing filled_quantity/filled_size_dollars become compatibility mirrors of applied, never merely observed, totals for version1. |
| fills | `entry_version`, `entry_scope`, `entry_application_key TEXT`, `entry_observation_key TEXT`, `entry_evidence JSONB` (authority, source IDs, full evidence/fingerprint and cumulative target if applicable), `entry_quantity NUMERIC(28,8)`, `entry_consideration NUMERIC(38,16)`, `entry_position_id TEXT`, `entry_position_revision BIGINT`, `entry_order_revision BIGINT`, `entry_fee_state TEXT`. Existing order_id remains the local orders FK; fill_number is assigned under the order lock, not inferred from a venue ID. |
| trades | `entry_version`, `entry_scope`, `entry_local_order_id TEXT`, `entry_fill_id TEXT`, `entry_quantity NUMERIC(28,8)`, `entry_consideration NUMERIC(38,16)`. Existing order_id retains the venue ID; never silently repurpose it. |
| positions | `entry_version`, `entry_scope`, `entry_quantity NUMERIC(28,8)`, `entry_consideration NUMERIC(38,16)`, `entry_revision BIGINT`. Exact totals derive solely from linked committed acquisitions of this position lifecycle; initial totals never copy a legacy float position. |

Require every version1 row's scope fields to agree with existing user_id, venue/ticker/side where
present and is_paper. user_id must be non-null/nonzero UUID; account/subaccount tags must be known;
action is buy and outcome maps exactly to BUY_YES/BUY_NO. Application evidence/source/authority
must match its immutable order. Signal/decision IDs must already exist, refer to each other and
have the same non-null user; validate them under key-share locks at admission/application. No
null/global signal adoption. Persist that validated association in the immutable binding;
later changes to those prerequisite rows deny application, never rewrite the association.
No new signal/decision migration or claim to protect arbitrary superuser mutations.

Shared entry_version/entry_scope columns use the same SMALLINT/JSONB types in all four tables.
entry_started_at is write-once, required before observation application and never inferred from
a response. Persist completion/coverage halt reasons separately from merely observed acceptance
issues; expected legacy POST acceptance can still enter its existing bounded Get Order lookup.
A partial/conflicting completion halt survives later legitimate deltas and restarted replay.

Constraints and cardinality to implement/prove explicitly:

- Unique `(orders.id, entry_scope)`, `(fills.id, entry_scope)` and `(positions.id, entry_scope)`
  support composite FKs. Fills reference `(orders.id,scope)` and `(positions.id,scope)`; trades
  reference `(fills.id,scope)` and `(orders.id,scope)`. Deferred consistency checks require
  fills.trade_id to point back to the same trade and trades.entry_fill_id to point to that fill,
  with the same local order/scope, venue ID and exact Q/C. Partial unique indexes on non-null
  fills.trade_id and trades.entry_fill_id enforce one-to-one application links. No committed orphan.
  New cyclic/link FKs are DEFERRABLE INITIALLY DEFERRED, checked at the owned commit; constraints
  and triggers reject scope mismatches even when each referenced local ID independently exists.
- Unique `(order_id, entry_application_key)` for version1 fills; compare stored source components
  and full economic fingerprint on conflict. Unique `(entry_position_id, entry_position_revision)`
  and order revision/fill_number ordering identify each increment. A deferred constraint verifies
  final order/position revisions, counts and exact totals equal their linked version1 fills.
- Unique scoped venue order identity uses user/account/subaccount/venue/mode extracted from
  canonical entry_scope plus venue_order_id, excluding instrument/action: the same venue order
  cannot be adopted for another instrument or request. Once set, it cannot change.
- Replace idx_orders_idempotent with a legacy-only index retaining its original target/predicate
  and a version1 index on original request identity within user/account/venue/mode. Existing
  public save_order's old ON CONFLICT is incompatible after this change; new methods use explicit
  version1 targets. They never interpret an empty ID or generic unique violation as success.
- Replace open-position uniqueness with version1 unique `(entry_scope)` WHERE status='open'
  AND entry_version=1. Scope includes mode, account, instrument and outcome. Retain a separate
  legacy-only `(ticker,venue,side,user_id,is_paper)` open index. SQL/queries must name the exact
  predicate; no mode-blind ON CONFLICT. Different users/accounts/modes cannot aggregate together.

Use fixed exact representation: quantities have at most8 fractional digits, entry prices at most8
for event-derived consideration, and USD consideration at most16; SQL ranges above are the bounds.
Reject nonfinite, overflow or excess precision before SQL can round. Kalshi's stricter source
precision still applies. Event Q×price fits the chosen consideration scale; cumulative Q/C must
individually fit. Weighted delta/position price may be repeating: Q and C remain authoritative;
compatibility price fields are derived floats, not a reconstructed exact baseline.
Use a local Decimal context of at least80 digits for decoding, products and sums; reject exact-field
overflow/inexact quantization instead of relying on Python's default28-digit context or SQL casts.
Check aggregate position/order bounds before commit as well as each individual delta.

Existing double fields stay as documented approximate read mirrors, populated from exact Q/C and
never fed back into durable arithmetic/reconciliation. No broad model change to Trade/Position.
New durable receipt/read methods return Decimal totals; legacy dashboard/guard reads remain their
existing approximation and do not certify precise fees/exits/P&L. The existing live float
representation restriction is replaced only at this durable boundary, not weakened in a fallback.

For version1 requests, binding.amount/unit is authoritative. Drop NOT NULL on only the three
legacy orders.requested_price/requested_size_dollars/requested_quantity mirror columns so an
unpriced market request or USD request with unknown shares uses NULL, not a fabricated zero.
Fill known request mirrors from the actual admitted descriptor; require non-applicable mirrors
NULL via version1 checks. Legacy rows keep their values. This is bounded nullability/read
compatibility, not a change to request sizing or a general numeric migration.

For new fills set `entry_fee_state='unknown'` and fee_dollars=NULL unless a later fee contract
authorizes a charge projection; preserve raw actual fees in entry_evidence.027 drops only that
column's NOT NULL restriction and adds version1 state/value checks. Likewise version1 order
fees_dollars stays NULL/unknown rather than defaulting to a certified zero (drop its NOT NULL
restriction). Legacy zero values are unchanged and unproven. Existing generic order/fill readers
must tolerate these NULLs in the narrowly touched storage mapping; no fee computation is added.
No economic row is created for ID-only, pending, unavailable or zero-quantity observations.

**Legacy policy:** do not update/backfill historical rows. New entry checks for open legacy positions
matching ticker/venue/outcome: same known user, or null/zero/unknown user, blocks the new acquisition
across all modes/accounts because historical mode/account allocation is unproven. Known different
non-null users remain separate. Never merge by ticker or infer a lifecycle baseline from old trades.
Existing legacy orders/fills cannot be promoted; retain them read-only and return LEGACY_BASELINE_UNAVAILABLE.
Ambiguity is a rejection/reconciliation issue, not a new quarantine ledger or deletion.

027's write guards reject new legacy inserts and any legacy economic mutation on these four tables.
Version1 fills/trades are immutable; version1 order binding/authority is immutable; position changes
must be linked exact acquisition increments with matching revision/aggregate constraints. Reject
legacy close/mark/exit mutations of managed positions; no entry writer token/boolean bypass.
This is an explicit writer compatibility break: old writers must be stopped before any future
application. No rolling old/new writer coexistence and no downgrade after managed rows exist.
An attempted old public helper must fail, not partly update a row. Existing reads remain available.
Production cutover, role privileges, RLS and rollback procedures require a later state-specific
rollout ticket; this proposal neither runs it nor assumes superuser-resistant access control.

## 6. Owned transaction and reconciliation

PostgresStorage creates a dedicated entry connection from the original explicit dependency for
each admission/start/application/reconciliation call. Never borrow its general _conn with an
implicit read transaction. Require idle status, non-autocommit and the supported schema marker;
own one top-level BEGIN/COMMIT/ROLLBACK. No _ensure_connected, public save_* calls, nested savepoint
pretending to be a commit, silent reconnect or SDK work inside the operation. Connections used by
an uncertain operation are discarded, not reused. Context ownership remains attached to the
original response collector until pending futures drain.

Use READ COMMITTED with explicit serialization. One order observation transaction:

1. Revalidate dependency/user/account; acquire a transaction advisory lock on the canonical
   user/account/subaccount/venue/mode namespace, then lock the original order FOR UPDATE. The
   same namespace lock protects admission's unresolved-prior-scope check. Compare immutable
   admission and source/authority, then attach/check venue order identity. Load durable observations,
   application rows and Q/C/revision; never initialize these from process memory.
2. Acquire a transaction advisory lock on the canonical position scope before reading/creating
   its open position. Fixed hash collisions only serialize unrelated scopes; compare full scope
   on every row. This protects the absent-row case among protocol writers; the unique index is
   the final database backstop. All operations lock namespace, then order, then position in that
   order; multi-venue plan admission acquires sorted namespace keys then sorted order IDs. One
   observation handles one order/position scope. This intentionally serializes one account's
   short entry transactions; it does not hold a lock across submission/waiting for venue evidence.
3. Recheck legacy blockers and existing position scope/lifecycle, locking an existing version1
   position FOR UPDATE. Re-decode the source, compare identical/conflicting applications and
   calculate exact new deltas from durable state. Retain alternate/unknown evidence on the order.
4. For each new supported delta allocate deterministic local fill/trade IDs from application key
   (full SHA256 text with distinct prefixes), choose the existing/new position ID, and insert
   the fill/trade with both links, exact Q/C and revisions. A new position ID is fixed by its first
   application key; it is a lifecycle ID, not a hash reused after closing. Increment exact position
   totals/trade_count and order Q/C/revisions. No random new ID on retry.
5. Store observation/application association and issues; validate deferred links/aggregates, then
   commit once. Only acknowledged commit yields new durable receipts. Duplicate applications
   yield existing receipts and current durable totals; caller must not re-add historical deltas.

Internal helpers `_entry_transaction`, `_lock_entry_order`, `_lock_entry_position`,
`_apply_entry_delta` operate on the supplied cursor and never commit. The outer operation alone
owns commit. All mutations constrain original IDs AND full scope; check affected-row counts.
No exception path reconnects midway. Deadlock/serialization/constraint failure with acknowledged
rollback returns no committed effects and halts this entry; this checkpoint has no automatic retry.

An exception after the write/commit attempt is unknown unless rollback is conclusively acknowledged.
Even a proven rollback halts continuation; it is not permission to place another order. Unknown
does not imply rollback. Do not persist a guessed unknown marker in a second transaction after loss;
the caller retains its original observation/attempt and the durable intent already exists.

Reconciliation uses the SAME deterministic keys/fingerprints and scoped primary database. A present,
fully linked matching committed receipt establishes application. A changed row is conflict, not
success. An absent row alone is **not** proof of rollback while the original transaction/session
could still commit. To return proven_not_committed require the original synchronous connection to
be closed/quiescent, absence of that exact backend PID+backend-start identity, and a fresh order
lock barrier on the primary after that session ended. Capture attempt/backend identity before
work; if unavailable, a lock times out, primary identity is unverified or an old worker may still
execute, return unresolved. No detached background database writer or automatic server termination.
Never treat a lagging replica's absence as proof. Reconciliation performs no economic writes.

The original run-wide application_unknown halt stays in force until this independent result is
established. A recovered receipt may update its application fact, but does not automatically clear
entry_halted, flush deferred observations, retry a rolled-back write or submit orders. A later
explicit replay caller can deliver retained evidence with the same durable admission under the
original scope; any unresolved prior attempt first needs reconciliation. No recovery scheduler.
Loading a restarted replay never arms a new trading run. Persisted halt reasons remain binding;
an uncertain original run cannot escape its halt by minting a new run/request ID. New entry
admission on a scope with unresolved prior submission/application requires a separately established
reconciliation result; this proposal adds no automatic account-wide recovery or restart rollout.

## 7. Actual integration and narrow future file list

Future code scope, only if separately accepted:

- `neutralis/execution/models.py`: the typed durable scope/admission/observation/result/receipt types.
- `neutralis/execution/outcomes.py`: durable-admission and result handling beside existing decode/
  collector paths. Send original raw evidence once per response, not a caller delta. Durable mode
  derives acknowledged state from returned persisted totals; do not run the in-memory subtraction
  a second time or require a restarted order to start at zero. Repeated receipts are not increments.
- `neutralis/portfolio/manager.py`: the two named entry facade helpers, actual dependency/leg checks
  and durable receipts. No exits, fee accrual, mark-to-market or generic model redesign.
- `neutralis/storage/postgres.py`: optional explicit account/entry-connection dependencies, the four
  public durable operations and bounded internal cursor helpers; necessary NULL read compatibility.
  Existing committing helpers remain legacy and cannot be used as durable fallbacks.
- `neutralis/engine/event_loop.py` and `scripts/run_once.py`: admit complete selected plan before
  submission; persist start before each existing adapter call; feed original response to the same
  collector/facade. Keep real ordering, unit/depth/full checks and M1 permission gate. No adapter,
  payload, sizing or endpoint change.
- `migrations/027_durable_entry_application.sql`, only the four tables/constraints described above.
- `tests/arbitrage/test_durable_entry.py`, `test_durable_dispatch.py`, `test_durable_postgres.py`,
  `tests/arbitrage/fixtures/durable/` (synthetic scoped data and minimal predecessor DDL), and one
  `tests/arbitrage/disposable_postgres_runner.py`. Existing support/expectation adaptations limited
  to `tests/arbitrage/conftest.py`, `outcome_support.py`, `test_dispatch.py`, `test_routes.py`,
  `test_lifecycle.py`, `test_review_regressions.py`, `test_outcome_replay.py`, `test_partial_outcomes.py`,
  `test_completion_regressions.py` (all under tests/arbitrage), and `tests/test_portfolio_manager.py`.
  Replace superseded helper-call assertions with durable receipts/row effects through real code;
  preserve every meaningful original positive/negative case and source fixture. Preserve the
  existing strict offline runner. Future DB runner is separate and cannot accept a remote DSN.
- `docs/arbitrage/` evidence/compatibility notes. No other source/schema/config files implicitly allowed.

Missing dependency/schema/account/admission denies before any order. Original result delivery and
supported recording after dynamic control revocation remains permitted when storage is trustworthy;
do not add live-arm/kill checks to admitted response writes. Application uncertainty blocks ALL new
outbound actions and accounting writes; already-owned late replies remain observable/not_attempted
under their original dependencies. Resuming a new process cannot relabel that original user/run.

SimulationSink remains the only runtime paper sink. Durable production facade accepts live only;
readonly/shadow/paper must not construct this connection or write PostgreSQL. SQL schema supports
mode isolation for explicit disposable fixtures, not a production paper service. Two-mode database
proof seeds a version1 paper counterpart in the synthetic fixture transaction; a paper runtime or
paper DurablePlanIntent must still deny the production storage path. No trusted test mode unlock.

## 8. Finite acceptance matrix and proof stages

Every case pins accepted code/schema/fixture hashes, scope, authority, raw source, expected exact
Q/C and application identities. Retain existing ARB003 source fixtures unchanged. Two nonzero test
UUID users and explicit synthetic account/subaccount namespaces replace zero/unknown defaults.
No case creates real SDK clients, account calls or production data.

| Case | Required outcome; proof boundary |
|---|---|
| Same event concurrent and restarted | One committed fill/trade/increment; identical receipt ID, no added historical delta. Conflicting Q/C/currency/order/action under that identity: retained issue, no second acquisition. A+B |
| Cumulative2/$0.80→5/$2.30→repeat | Deltas2/$0.80 and3/$1.50; total5/$2.30; duplicate adds nothing. Missing C, lower unknown point and same-Q changed-C stop. A+B |
| Snapshot/event overlap both authorities | snapshot2→event2→snapshot5→event3→snapshot5 never doubles economics; alternate coverage stays unresolved unless already proved by the fixed authority. No authority switching. A+B |
| Two users/accounts/subaccounts/modes | Same external IDs under distinct real scopes remain separate; wrong-scope replay/link denied. Live acquisition coexists with fixture paper position; paper runtime zero DB construction. A+B, paper SQL seed only in B |
| Same/different orders sharing position | Duplicate same order adds once; two orders create/update one scoped position with exact sum under concurrent absent-row and existing-row races. Different scope never shares. A+B |
| Fractional/range boundary | .25×.40000001=.1000000025 preserved exactly; Q/C scale/range overflow rejects before SQL rounding; derived repeating price never becomes baseline. A+B |
| Unsupported/unknown scope and legacy | Known unavailable acquisition: zero orders/intents/fills/trades/positions. Already admitted unsupported observation: no economic rows. Null/zero legacy user, ambiguous mode, missing account, legacy open position or old writer: deny without backfill. A+B |
| Typed forgery | Caller projection delta/baseline, altered admission/source/authority/receipt or valid-looking IDs with another storage user cannot authorize application. Database-loaded original wins. A+B |
| Rollback boundaries | Inject after observation update, fill insert, trade insert, link, position increment, watermark update and before commit. Acknowledged rollback leaves no partial delta; prior committed acquisitions survive. A+B |
| Lost commit acknowledgement | Driver double commits then raises: run unknown/no retry. Fresh scoped lookup returns the SAME committed receipt; absent/blocked backend case stays unknown until barrier/quiescence proven. A+B |
| Control/storage stop and late replies | Real dispatch starts A/B as permitted; after control stop original results still record. After A unknown, B remains observed/not_attempted; no new order or write. Replayed receipt cannot revive continuation. A; B checks actual durable facts |
| Admission/start crash windows | Each window in section3 has its prescribed state and zero automatic resubmissions; same durable request is loaded on restart. A+B |
| Constraint/writer compatibility | Deliberate wrong-scope FK, orphan fill/trade, mismatched quantity mirrors, duplicate revision, null fees/default legacy insert and mode-blind position collision reject atomically. B required |

**Stage A — future offline code proof:** real normalization, PortfolioManager, storage transaction
algorithm and event/polling entry gates with external connection/cursor/transport doubles, under
the existing network namespace and inspected offline runner. Replace only external boundaries;
do not mock away durable dispatch or application. Doubles can prove arguments, ownership, control
flow, receipts and halts; SQL call counts cannot prove PostgreSQL locking/FK/NULL/numeric semantics.
No skips/xfails for required unavailable/conflict cases. Reproduce affected ARB003 tests and report
the unchanged historical directional34/1 separately. No database required for Stage A.

**Stage B — separately unassigned disposable PostgreSQL proof:** no installation/start/SQL now.
Propose PostgreSQL16 as a bounded test target, with exact patch/binary provenance pinned before
that future stage. It would not prove compatibility with the still-unknown production major/version.
Use a new task-owned directory under this docs worktree's .context, never existing PGDATA or DSNs.
The future runner must reject any supplied remote host, ambient DATABASE_URL/PG* credentials or
pre-existing data directory. Start within a network namespace with no external interfaces, Unix
socket only (`listen_addresses=''`), private0700 directories, test-only local trust and synthetic
database/user names. No production role/credentials. Preserve socket/secret-file/SDK guards for
everything except that exact allowlisted Unix socket connection in the separate DB test runner.

Planned finite commands, **not executed or authorized by this document**; `/task/pg16/bin` is a
future verified task-local binary directory, not a request to install it now:

```sh
unshare --user --map-root-user --net env -i PATH=/usr/bin:/bin /task/python/bin/python -B tests/arbitrage/disposable_postgres_runner.py --pg-bin /task/pg16/bin --root .context/arb004-disposable --case-file tests/arbitrage/test_durable_postgres.py
```

That future runner creates a new mkdtemp child, initializes it with `initdb -D DATA --no-locale
--encoding=UTF8 --auth-local=trust --auth-host=reject`, starts `pg_ctl -D DATA -o "-k SOCKET
-c listen_addresses=''" -w start`, and uses explicit socket/database/user connection arguments.
Load only committed minimal predecessor DDL for the four tables plus their synthetic signal/
decision prerequisites, then027 in a transaction. The predecessor fixture must be source-anchored
and structurally checked against relevant migration definitions, excluding all historical UPDATEs,
auth/key tables and unrelated migrations. Seed only synthetic rows. Do not run the migration chain.
Capture server_version, DDL/fixture hashes, constraint inventory, connection/lock traces and final
row/receipt totals for each case. Run independent connections for races; acknowledged failures must
assert actual rows and transaction rollback, not mock counts. Simulate lost acknowledgement by
raising after a real commit and separately test in-flight/rollback ambiguity under explicit barriers.
Finally `pg_ctl -D DATA -m fast -w stop`; remove only the verified task-created directory. On failure
still stop/clean up, retain sanitized logs outside DATA and report cleanup result. No scheduler.

Stage B must be explicitly dispatched after the complete contract/code-stage scope is reviewed;
success would establish only this disposable schema/application behavior. A production migration
requires a later authorized schema/version/legacy/old-writer inventory and concrete rollout plan.
No production backfill, repair, SQL application or arbitrage activation is implicit.

## 9. Dependencies, decisions and stop point

No founder input is needed to choose these reversible protocol IDs, schema shape, precision bounds,
locking order or synthetic tests. Missing production account namespace/subaccount provenance,
unknown legacy ownership/mode, and actual schema/version/active writers remain explicit unavailable
dependencies for any eventual rollout. If existing records cannot establish them, the account/data
owner must later identify the account or choose a historical reconciliation policy; do not guess
Constantine/Gaspar ownership. This is not an account-onboarding or key-replacement request.

Whether to apply migrations, permit a database stage, resume historical orders, correct compatibility,
change precision or enable production is outside this dispatch and needs a concrete subsequent
scope. No approval question is needed to finish this document. Freeze it after local commit,
full export and one freshly validated proposal callback to Astra. Preserve ARB003/M1/candidate01/
planning4200134/recovered audit, Railway publication hold and accepted UI003/UI004. No product/test/
schema/config changes, DB/service start, external vendor research, purchases, push or deployment.
