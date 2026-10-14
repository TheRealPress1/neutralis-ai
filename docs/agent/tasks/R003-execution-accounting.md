# R003 — Execution/accounting owner lane

Status: proposed dependency lane, not dispatchable. One future owner must sequence changes; this outline is not a single giant implementation order.

First dependency: obtain `ad37071-phantom-fill-fix.patch` or the complete Neutralis transfer bundle; verify patch identity, parent, paths and regressions, and import exactly once into an isolated candidate if appropriate. Source `d524b5a` must not be represented as the reviewed `ad37071` head. No reconstruction from handoff prose.

Proposed sequence, each with an exact candidate and independent review:

1. Verify and preserve the transferred unfilled-leg fix and all seven reported regressions.
2. Define explicit read-only/shadow/live modes and fail-closed control errors without breaking offline scoring.
   The same lane must own and verify account-specific effective risk settings: the baseline loader selects an active NULL-user profile. R001 protects frontend actions but does not make those saved values govern the engine. Freeze the profile propagation contract and test two accounts' actual decision inputs before claiming live readiness. Account provisioning is an explicit separate dependency, not an assumed database fact.
3. Reconcile confirmed fills by account, venue, instrument, side and order/execution identity; handle unequal fills and duplicate/retried events idempotently.
4. Persist every confirmed live leg even when a subsequent leg/depth check fails; prevent paper fallback from concealing a live exposure.
5. Separate an exit signal from exchange submission, confirmed exit fills and realized accounting. A quoted exit must not falsely close a live position.

Proposed shared ownership: `neutralis/portfolio/`, relevant `neutralis/engine/event_loop.py` paths, `neutralis/execution/`, `neutralis/config.py`, `scripts/run_once.py` call sites and targeted offline tests. Storage/schema contracts require explicit reviewed tickets before changes. Preserve existing adapters, normalized models and scanning interfaces unless a specific defect requires an approved change.

Required proof includes side-specific unequal fills, no-fill/partial-fill paths, retries, one venue filled/other failed, interrupted processing and restart, control lookup errors, shadow mode with prohibited network/order calls, failed/pending exits and account isolation. All use mocks or recorded fixtures, never live trading or database repair.

Before dispatch: split into concrete artifact-bound tickets, verify the missing patch, approved model/concurrency budget, one builder workspace/branch, exact file list and peer challenge. Stop at each PR boundary. No service startup, historical repair, migration replay, merge or deployment.
