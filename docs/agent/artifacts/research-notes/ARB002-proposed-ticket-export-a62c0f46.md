# ARB002 proposal — explicit execution modes and offline dispatch proofs

**Status: proposed, not accepted or started.** Prepared under the documentation-only
[Astra handoff](CURRENT-HANDOFF.md). Acceptance of this proposal would authorize only the bounded
offline implementation described as M1, after Astra assigns one Python execution/accounting writer.
It would not authorize account access, daemon runs or a live pilot. Root R003 remains unassigned/frozen.

## Problem, source and ordering

At exact `ad37071ae6bbc4a31289f9e662388c50e92ac3d3`, `ExecutionConfig.live_trading_enabled`
defaults true; the event path returns early when false, while polling can simulate after live failure.
Missing/failed control reads can allow continued work. Mode choice must become explicit before changing
scanner/fee inputs that reach these paths. This ticket changes dispatch permission and side-effect
boundaries; fill truth, position isolation and trading profitability are separate questions.

Future implementation branch base is **exact `ad37071`**, parent `d524b5a`, tree
`e83cb4b7f5c91396ca58bbcb19e8e2e25e54d057`. Create that branch only after M1 acceptance/owner assignment;
branch creation itself needs no separate founder decision. Preserve the original commit hash, the
planning branch, recovery ref and read-only audit worktree. Never replay the patch or execute its SQL.

## M1 mode contract

Proposed settings names are `EXECUTION_MODE` and `LIVE_TRADING_ARMED`. They are specification text here;
no environment/configuration is changed by this proposal. Parse mode, startup `LIVE_TRADING_ARMED` and
the legacy live veto once into an **immutable policy for that run**, passed explicitly to both runtimes
and executor boundaries. Changing any of those three values requires stopping and starting a new run.
No environment reread, executor rebuild or second live configuration service supplies in-run disarming.
Dynamic revocation comes only from the existing exact-user automation/kill-switch provider, checked
before every new outbound action. Stopping a run must preserve outstanding response delivery below.

| Mode | Permitted computation | Orders / account access | Persistence and lifecycle |
|---|---|---|---|
| `readonly` (default) | Read/normalize supplied market data; no execution candidate selection | No live or simulated orders; no credential loading or account calls | Local diagnostic output only; no trade/position/order/fill/fee-ledger, settlement, MTM, exit or DB writes |
| `shadow` | Score/guard/select hypothetical candidates on supplied data and reference portfolio | Zero live orders and zero simulated fills; no credential loading or account calls | Mode-labelled hypothetical decisions to a run-local sink only; no portfolio mutation or production DB writes |
| `paper` | Explicitly run the existing `PaperExecutor`/fill simulator using supplied data and an isolated simulation sink | Zero live submit/cancel/close calls and zero account calls | Simulated order/fill/position records only in the explicitly supplied run-local in-memory/test sink; `is_paper=True`; production/shared Postgres rejected |
| `live` | Existing dispatch only when armed at startup, current user controls allow, and the selected route has separately verified eligibility/access | May reach the existing live adapter; M1 validation uses mocked transports only | No paper fallback. Outstanding responses retain their original result/recording path after revocation. Existing live bookkeeping/fill truth and real exits are not certified |

For this ticket, all inputs, sinks, control providers and venue transports are offline doubles.
These runtime semantics do not authorize future data/network access. `paper` without an isolated sink
returns `PAPER_STORAGE_UNAVAILABLE` and creates nothing. There is no persistent paper service in M1;
shared storage isolation is deferred, not claimed solved by `get_open_position(is_paper=...)`.
Re-use the current simulation/accounting interfaces with injected test storage; no second execution
engine, durable store, accounting redesign or database adapter implementation belongs here.

Inactive modes must bypass live-client construction, credential loaders, authenticated bankroll reads,
production persistence/notifications and automatic settlement/MTM/exits, including periodic callbacks.
These are restrictions on work started by that run. They must not be applied to the original result
delivery/recording continuation of an already-started live request, even while its run is stopping.
Local diagnostics identify requested/effective mode and a bounded denial reason, without secrets.
`shadow` can observe a rejected control decision but cannot convert it into a simulated or live fill.

### Legacy flags and explicit arming

Trim/case-normalize modes; accept only `readonly`, `shadow`, `paper`, `live`. An unset mode selects
`readonly`. Empty/unknown mode or malformed boolean is a configuration error with zero side effects.
Booleans accept `true/1/yes` and `false/0/no`, case-insensitively after trimming; empty is malformed.

| Startup configuration (immutable for the run) | Required outcome |
|---|---|
| New settings absent; legacy flag absent, true or false | `readonly`; legacy presence never implicitly selects a mode |
| Explicit inactive mode; legacy flag either valid value; arm either valid value | Selected inactive mode; arming/legacy true cannot promote it to live |
| `live`; arm absent/false | Deny: `LIVE_NOT_ARMED` |
| `live`; arm true; `LIVE_TRADING_ENABLED=false` | Deny: `LEGACY_LIVE_DISABLED`; explicit legacy false remains a live veto |
| `live`; arm true; legacy absent/true | Live permission is only a candidate; require fresh user controls and route availability below |
| Any invalid mode/arm/legacy value | Configuration error; no live or paper fallback |

Changes to environment values after preparation do not change this table's outcome for an existing run.
Startup-arm false is a separate denied-configuration test; it is not a dynamic control-provider test.
The historical implicit true default must not count as arming. WebSocket/polling selection, maker
preferences, credentials, `NEUTRALIS_USER_ID`, profile overrides and an empty active-user list cannot
grant permission. Legacy single-user fallback must satisfy the same explicit user-scoped control gate.
Once a run selects live, unavailable credentials, rejection, exception, timeout or an early return
must not call `PaperExecutor`. Removing fallback is in M1; reconciling a real already-filled leg is not.

### Control lookup and revocation

Before live client/account initialization and **each new outbound action**, including submit, cancel,
cancel-all, close-position, a subsequent leg or any retry, require the immutable policy to specify live,
startup-arm true and no legacy veto, plus a fresh successful lookup for that exact user:
`status == "running"` and `kill_switch is False`. Use the existing user-scoped
`PostgresStorage.get_automation_state` interface through an injected provider. A missing user, unscoped
fallback row, missing row, missing/malformed field, unknown status, exception or timeout is
`CONTROL_UNAVAILABLE` and denies mutation. `paused`, `killed` or a true kill switch is
`CONTROL_STOPPED`. No cached successful read or global/other-user state may authorize a request after
the next lookup fails. The event engine's periodic check is not a substitute for the per-request gate.

For paper, use explicit run-local controls and an isolated sink; absent/failed controls deny simulation.
Readonly/shadow do not query real account/control services. Route eligibility/access is a separate
injected, deny-by-default availability input for live; it cannot block synthetic venue-agnostic tests.
No new auth/MCP/eligibility discovery service is part of M1.

Revocation denies later outbound actions, including retries and cancellation/close requests; it does
not silently cancel resting orders or claim exposure is flat. Deny newly initiated automated
settlement/MTM/exit work while permission is unavailable, **not delivery of an outstanding result**.
An action that started while permitted retains its original user, request context and result/recording
continuation. Deliver its eventual response to that original handler even if controls have since
stopped, failed or become unavailable. Do not gate that delivery on a fresh allow decision, discard
the response, close its recording dependency prematurely, or redirect it into a new run or paper sink.
Any subsequent outbound action attempted by the continuation must pass the normal current-controls gate.

This preserves the original response delivery and recording path, including its existing semantics;
it does not certify normalized fills, repair pre-existing early-return losses, or add recovery/unwind,
durable response queues or crash recovery. An in-flight external request cannot be recalled. M1 must
not introduce a new outcome-loss path by blanket ledger gating or by abandoning an outstanding
continuation on orderly stop. Partial outcomes still prevent a live-readiness claim.

### Named dependency and startup interfaces (bounded M1 ownership)

The one Python execution/accounting owner assigned by Astra owns these small interfaces and their
integration in the existing wrappers/dispatchers/adapters. RH001 retains credentials/auth ownership;
none of these interfaces derives credentials or discovers venue capabilities. Names below are intended
interfaces for the proposed implementation, not new code or an open-ended dependency-injection design.

| Interface | Ownership, binding and absence/invalidity behavior |
|---|---|
| `ExecutionModePolicy(mode, startup_live_armed, legacy_live_veto)` | Frozen value in proposed `neutralis/execution/mode.py`, built only from validated startup values. Missing/invalid policy at a dispatch/adapter boundary denies; no implicit live defaults or environment rereads |
| `ExactUserControlsProvider.read(user_id)` | Small injected callable using the existing exact-user `get_automation_state` lookup contract for live, run-local controls for paper. Bound to the run's user; no unscoped/global-user fallback. Missing provider, wrong user or invalid/failed read yields `CONTROL_UNAVAILABLE`; known pause/kill yields `CONTROL_STOPPED`. It is the sole dynamic revocation source |
| `market_inputs` and `reference_portfolio` | Explicit supplied normalized market snapshot/cache and reference portfolio snapshot through the existing model interfaces, owned by the runtime caller. No implicit live fetch/account lookup to fill a missing input. Shadow/paper/live candidate dispatch require both; readonly needs only market input. Missing/invalid required input yields `INPUT_UNAVAILABLE`. An explicitly supplied empty market cache means no candidates, not a permission grant |
| `DecisionSink.emit(decision)` | Explicit run-local in-memory/test sink for shadow decisions and paper diagnostics, owned by that run. Missing/invalid sink in a mode that requires it yields `DECISION_SINK_UNAVAILABLE`; no production logger/storage fallback |
| `SimulationSink` | Explicit run-local test/in-memory storage double exposing only methods already consumed by `PaperExecutor`/`PortfolioManager`, owned by that run. Use a bounded nominal sink type constructed from run-local test state without an external backing-store argument. Accept only that type bound to the prepared run, never arbitrary storage by duck typing or an `is_paper` flag. Reject `PostgresStorage`, its subclasses, Postgres-backed delegates/factories, missing sinks and wrong-run sinks as `PAPER_STORAGE_UNAVAILABLE` before constructing/calling them. No production Postgres factory is wired into a prepared paper run |
| Existing adapter `client_factory` / `transport_factory` and external `signer_factory` parameters where needed | Narrow lazy external-dependency seams on Kalshi, international and US adapters, including their `from_credentials` factories. Keep the real adapter, mutation methods, permission gate, payload preparation flow and existing response handling. Factories supply only external HTTP/SDK/signing dependencies, using offline doubles in tests; they cannot replace dispatch or construct an adapter with implicit permission |
| `live_storage_factory` and `route_availability` | Caller-supplied lazy factory for the existing live recording storage interface and a supplied selected-route availability snapshot. Neither is auto-discovered or a second dynamic revocation service. Missing/invalid required factory is `DEPENDENCY_UNAVAILABLE`; missing/invalid route evidence is `ROUTE_UNAVAILABLE`. Never use these as a paper sink or promote missing eligibility to available |

Add one import-safe, side-effect-free `prepare_execution_run(...)` callable in the proposed mode module,
used by `run_once`, the event/loop daemon wrappers and `EventEngine.start`/direct dispatch setup, and
by their unit tests. Its explicit keyword inputs are startup policy values, user identity, the controls
provider, supplied market/reference-portfolio inputs, decision/simulation sinks and the lazy external
factories/route evidence above. It returns a prepared immutable run context or a named denial; it does
not fetch data, read dotenv, construct a client/account/production sink, or invoke external factories.
Wrappers may supply an explicitly empty run-local market cache to populate later through the existing
data path; dispatch requires a valid supplied candidate/reference snapshot. Missing or invalid data
denies that dispatch without re-parsing policy, rebuilding the executor or fetching hidden defaults.

Real wrappers and direct-call setup must use this shared preparation **before** live-client, account
or production-sink construction. After preparation, the current exact-user control read is required
before allowed live external construction and each outbound action. A lazy exact-user control-store
reader may perform that read through the existing storage interface; it must not create recording
sinks or venue clients as a side effect. An inactive or denied run never invokes those production
factories. An adapter constructor/factory without an explicit valid prepared policy, user/provider and
external dependencies remains denied before signing or client/account access; credentials alone are
insufficient. Runtime callers keep the original recording handler/dependency alive for pending results.

Limit implementation to these policy values, callable parameters and existing per-run objects. The
mode module must import without loading config dotenv, clients, storage connections or wrappers.
Make only the corresponding explicit startup/import changes in the named files; no broad service
container, provider registry, generic injection framework, second engine, persistent simulation store
or credential redesign. In positive tests replace only the external dependencies at these boundaries;
keep the real startup-preparation callable, dispatcher, permission gate, adapter mutation method and
payload construction. Observe original result handling with a wrapping spy or the isolated storage
double, not by replacing the production response continuation with a test-only dispatcher/handler.

## Execution coverage and future file scope

Source locations below were read offline at exact `ad37071`; line numbers refer to that commit.
Relative links open planning-tree files, so use the preserved worktree/exact commit for line checks.
The implementation evidence must map every listed path to a test or an explicit gated caller.

| Surface | Required coverage / source |
|---|---|
| Config and setup | [config.py](../../neutralis/config.py): `ExecutionConfig` at 226, import-time dotenv at 27; default and all override paths must retain the mode policy |
| Polling, including legacy user fallback | [run_once.py](../../scripts/run_once.py): `run_once` at 1185 and `evaluate_and_execute_for_user` at 397; directional Kalshi/international/US, general complement/three-way/settlement signals, cross-platform international/US and Kalshi-only dispatch, both paper-fallback sites |
| Event candidate producers | [event_loop.py](../../neutralis/engine/event_loop.py): `_fast_arb_check`; `_execute_complement_arb`, `_execute_three_way_arb`, `_execute_xp_arb`, `_execute_volume_momentum`, `_execute_live_momentum`; `_run_directional_scan` → `_score_and_execute` at 1839 |
| Event live dispatch | Same file: `_try_live_execute` at 1983, `_execute_kalshi_live` at 2017, `_execute_cross_platform_us_live` at 2057, `_execute_cross_platform_live` at 2233, `_execute_xp_taker` at 2260, `_execute_xp_maker` at 2374 (including order polling/cancellation and subsequent legs) |
| Startup/wrappers | [event_daemon.py](../../scripts/event_daemon.py) `main`, `EventEngine.start`/`_build_initial_state`; [loop_daemon.py](../../scripts/loop_daemon.py) `main` → `run_once`; all use shared `prepare_execution_run` before external construction. Direct-call paths require the same prepared dependencies. Do not launch wrappers as tests |
| Control/account/periodic side effects | Event `_check_kill_switch` at 2968, `_fetch_startup_bankroll`, `_refresh_bankroll`, daily-loss checks, `_run_settlement`, `_run_mtm`, log/discrepancy flushes; polling control read, bankroll, `run_settlement`, MTM and `execute_exit`; wrapper state/metrics writes. Inactive modes must not reach production sinks |
| Kalshi mutation boundary | [execution/kalshi.py](../../neutralis/execution/kalshi.py): `KalshiExecutor.place_order`, `cancel_order`; mutating `_request` including retry must enforce policy before signing/transport |
| International mutation boundary | [execution/polymarket.py](../../neutralis/execution/polymarket.py): `PolymarketExecutor.place_market_order`, `place_limit_order`, `cancel_order`, `cancel_all`; enforce before signing/posting SDK calls |
| US mutation boundary | [execution/polymarket_us.py](../../neutralis/execution/polymarket_us.py): `PolymarketUSExecutor.place_market_order`, `place_limit_order`, `cancel_order`, `cancel_all`, `close_position`; policy checks only in M1 |
| Simulation and ledger callers | [execution/executor.py](../../neutralis/execution/executor.py) `PaperExecutor.execute`; [portfolio/manager.py](../../neutralis/portfolio/manager.py) `record_fill`/`execute_exit` and [settlement/settler.py](../../neutralis/settlement/settler.py) `run_settlement`: gate new simulation/background work at callers, preserve outstanding live responses to their original result/recording handler. No blanket gate inside recording or accounting logic change |

Proposed M1 touch list: `neutralis/config.py`; a small pure `neutralis/execution/mode.py` policy module;
`neutralis/engine/event_loop.py`; `scripts/run_once.py`, `scripts/event_daemon.py`, `scripts/loop_daemon.py`;
`neutralis/execution/{kalshi,polymarket,polymarket_us,executor}.py` for boundary checks/injection only;
focused new tests under `tests/arbitrage/`; task docs. Only the named dependency/startup interfaces above
and their import-safe integration are in scope. Factory paths, including `from_credentials`, must
default to denied without explicit prepared dependencies; no implicit production factory fallback.

Excluded from M1: result normalization/accepted-vs-filled semantics (including US `_normalize_result`),
matching, quantities/cost basis, fee/scanner/venue normalization changes, product UI, auth/key storage,
`neutralis/portfolio/`, `neutralis/storage/`, `neutralis/settlement/` implementations, migrations/SQL,
research fixture changes, new collectors, real exits and recovery/unwind. Do not touch `user_api_keys`,
`ApiKeyManager` or `DashboardShell`. If a necessary fix crosses these exclusions, return a bounded scope
revision to Astra; do not expand M1 silently. Caller gating does not certify the excluded implementations.

## M1 acceptance evidence — all required, offline

1. A complete configuration truth table proves the default, explicit inactive modes, legacy values,
   malformed input and startup arming/veto combinations above. Use the real shared preparation callable
   for both runtime paths; missing/invalid required dependencies deny before external construction.
   Verify mode, startup arm and legacy veto remain immutable after environment inputs change; a new
   run is required to change them. Profiles/legacy overrides cannot restore implicit live. Startup-arm
   false is a separate configuration case, not an environment-disarming test on a running executor.
2. A passing synthetic signal actually reaches each covered dispatch path. In readonly/shadow/paper,
   counters at **every mutating HTTP/SDK boundary** stay zero, including direct adapter invocation and
   maker retry/cancel paths. Credential/account factories and production storage/notification spies
   remain untouched. Merely rejecting every input signal does not satisfy this test.
3. Positive controls distinguish modes: shadow emits a hypothetical decision and no fills; paper
   invokes the existing simulator and records `is_paper=True` only in a run-local mock sink. The same
   signal in **explicitly startup-armed live**, legacy absent/true, valid user controls and synthetic allowed
   route reaches the real dispatch/adapter code and one expected mocked transport request per tested
   single action. Cover both polling and event paths and all adapter mutation methods. Assert payload,
   call count and zero paper calls. Keep real preparation, dispatch, gate, adapter mutation method,
   payload construction and original result handling; replace only the named external dependencies.
   An always-deny gate or tests that mock away production dispatch/permission/payload logic fail.
4. Test startup-arm false and legacy false as separate prepared configurations. For dynamic denial,
   change only the actual exact-user control provider to pause/kill, missing/wrong user or row/field,
   malformed status, exception/timeout. Keep the same immutable policy, dispatcher and executor;
   do not rebuild them or bypass the gate. Each denies with the specified reason, including later
   legs/retries/cancel/close actions; no cached/global-user bypass. Test unavailable route separately.
5. **Outstanding-response case (mandatory):** let the first mocked transport request start while
   permitted, hold its response, then stop controls through the actual provider before releasing the
   response. Without rebuilding the executor/context, prove the eventual response reaches the
   ORIGINAL result/recording handler with the original user/request context. Observe the real handler
   using a wrapping spy/isolated sink; do not substitute a test handler. Deny a second leg/retry through
   the real outbound gate and assert zero paper fallback. Repeat with a failed/unavailable control
   read. This proves preserved response delivery, not confirmed fill normalization or recovery of
   pre-existing early-return losses. Neither revocation nor orderly stop may newly discard that result.
6. Callback/wrapper tests prove newly initiated settlement, MTM, exits, bankroll, notifications and DB
   flushes cannot bypass inactive mode/control denial, while the outstanding response's original
   recording continuation is exempt from a new permission check. Test shared startup preparation
   with missing/invalid dependencies, direct adapter factories without explicit dependencies and
   paper given production Postgres/delegates/wrong-run sinks: all deny before external construction.
   Static call-site inventory complements behavioral tests; pure policy tests are insufficient.
   No daemon/main/polling loop is started.
7. Fixture names distinguish synthetic authorization cases from verified venue examples. Network is
   blocked before imports (including DNS/socket access); real DB/SDK/credential/notification creation
   fails unless explicitly replaced with an isolated double. Prevent dotenv reads before importing
   any affected callable. Record exact implementation SHA, commands, Python/dependency versions,
   package import path, test results and remaining limitations. No real key/account/venue calls.
8. Focused new tests and affected inspected regressions pass with no new failure. Carry forward the
   historical directional duplicate-position failure separately with provenance; do not relabel it
   as a pass, silently xfail it, patch it out of scope, or count old tests as a new run. Required mode
   proofs may not be skipped/xfail. Review the exact new code head; label review during the Claude
   limit as same-family review. Prior Fable review is evidence for the preserved base only.

M1 stops at offline code/test evidence for Astra after separate ticket acceptance. This documentation
continuation stops earlier, at the proposal commit. Passing mocked live controls is no authorization
or evidence of live venue eligibility, confirmed fills, durable paper isolation or executable edge.

## Separately bounded follow-on: confirmed-fill identity (not part of M1)

Proposed next ticket **ARB-FILL-1**, requiring M1 review and the same assigned Python owner. Scope:
define a normalized fill-evidence contract and consume it once per matched leg; add ticker/venue/side
and distinct execution/fill identity, confirmed quantity and actual price; do not reuse one result
for YES and NO or fall back to requested quantity. Accepted/pending order ID alone is no fill.
Unknown/ambiguous status, quantity or price must not synthesize a position. Preserve original
`orderID` handling and existing cross-platform US tags; fix the two polling directional tagging sites.

Required future touch list includes **`neutralis/execution/polymarket_us.py`**, specifically
`PolymarketUSExecutor._normalize_result` and its market/limit/close callers if their result contracts
change. It cannot promise US success/fill semantics while excluding that file. Other bounded files:
`neutralis/execution/models.py`, Kalshi/international result adapters as required by the contract,
`neutralis/portfolio/manager.py` matching/recording only, the event/polling result-building sites and
focused tests. Proposed fixtures: accepted/no execution, confirmed full/partial quantity, duplicate
result, two opposite sides sharing ticker/venue, mixed venues, missing identity/quantity/price, and
reordered results. Synthetic generic fixtures do not require operator venue eligibility;
international-specific response fixtures/normalization remain venue-conditional.

Acceptance must separately prove no booking from acceptance-only/missing fill data, exact confirmed
size/price, one-to-one side-aware consumption, correct polling tags and retention of prior regression
behavior. This follow-on does not solve durable deduplication, crash recovery, storage uniqueness,
early-return reconciliation, partial-fill recovery/unwind, real exits or fee-aware P&L. Those require
additional tickets and keep real trading unavailable even after M1 and ARB-FILL-1 pass.

## Research gates after mode/fill correctness

[ARB-T1–T7](05-first-tickets.md) remain separate proposals. Fee/scanner/normalizer changes that can feed
live behavior wait for M1; the execution-connected sequence is M1 → ARB-FILL-1 → separately accepted
registry/fee/recorder work. Venue-agnostic offline planning/tests do not wait for account eligibility.
Selected venues and executable-opportunity claims do; international-specific work is conditional.

Kalshi primary fee proof is currently **UNAVAILABLE**. Existing secondary coefficients cannot produce
a verified net edge. Intended future evidence is the official unauthenticated per-series fee-change
metadata (`fee_type`, `fee_multiplier`, effective dates) described at
[Kalshi get-series-fee-changes](https://docs.kalshi.com/api-reference/exchange/get-series-fee-changes.md),
plus primary proof of the applicable formula/rounding. No fetch is made by this proposal. Until evidence
covers each selected series and timestamp, return an explicit unavailable fee/opportunity status and
exclude it from executable claims. A deterministic test of this denial should **pass**; fee correctness
and readiness remain unavailable, never hidden in an xfail or filled with a presumed coefficient.
