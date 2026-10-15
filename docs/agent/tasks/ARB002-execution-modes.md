# ARB002 — execution modes and offline dispatch implementation

Accepted for M1 implementation on 2026-09-07 after Constantine requested starting the arbitrage strategy. This promotes the independently reviewed proposal at planning head `a62c0f46bf5bd6195dfa649f11804f353c5b8943` to the next bounded implementation milestone. The exact proposal remains the implementation contract; root's preserved export is `.context/ARB002-proposed-ticket-export-a62c0f46.md`, and the review is [proposal contracts](../reviews/ARB002-proposal-contracts-gpt.md).

Sole Python execution/accounting writer: existing GPT Ultra arbitrage lead `50ea0c8e-5888-4d14-9f42-3c1ade31d33e`, workspace `381b00ed-cf4a-4c8c-9ab8-090faad31cc0`. Astra dispatches during reported Claude quota. Preserve the planning branch and read-only audit worktree; create one isolated implementation worktree/branch at exact recovered `ad37071ae6bbc4a31289f9e662388c50e92ac3d3`. Verify parent/tree/ref and never reapply its patch or execute its SQL. Do not rename existing branches or launch another execution writer.

Implement the proposal's immutable startup mode/arming/legacy policy; exact-user dynamic controls before each new outbound action; readonly default; shadow without fills; paper using only the explicit run-local nominal simulation sink; mocked live path without fallback to paper; and preserved original delivery/recording continuation for outstanding responses after revocation. Use the named bounded preparation, input, sink and dependency seams. Missing/invalid dependencies deny; inactive modes must not instantiate live clients, load credentials or use production persistence.

Validation is offline, with positive and negative dispatch proofs at the real runtime boundaries, injected account/venue/storage doubles and network blocking. Do not start daemons or polling loops as checks. Locally commit a reviewable candidate, report exact tested head, command exits and evidence, then freeze for independent review. No live orders, real account connection, production DB writes/repairs, persistent paper service, push/merge or deployment in M1.

Mode controls do not fix fill normalization, partial outcomes, fee accounting, storage mode isolation or exchange-confirmed exits. While implementing, document the smallest next fill/accounting/replay milestone with concrete source findings; do not combine those changes into M1. The founder's restart direction supports continued implementation planning, not a live-readiness claim or automatic daemon launch.

## Candidate 01 independent review — 2026-09-07

Frozen code `8f0d9359a871870f2f8a51d9718c5c90cf7c0b5b`, parent `ad37071ae6bbc4a31289f9e662388c50e92ac3d3`, tree `fada46292c6817a047d4cc457f0c0031db0c0ce0`. Builder evidence is committed at `docs/arbitrage/ARB002-M1-evidence.md`; selected tests report 190 passes, with the separate directional suite retaining one historical duplicate-position failure (34 pass/1 fail). Builder used Python3.9.25 and optional SDK stubs; these do not establish installed-SDK compatibility.

Root independently verified the 45,211-byte bundle and SHA256 `1b513ce8eaab38f3413043f49ccae8b74720332fa0744be1c29f636df7980f7d`, Git prerequisite and candidate identity, then imported `refs/reviews/arb002-m1-c01` and detached `.context/arb002-review-c01`. Transfer receipt: `.context/arb002-review-transfer/8f0d9359a871870f2f8a51d9718c5c90cf7c0b5b-receipt.json`. Independent local GPT reviewer `/root/arb_contract_check` owns the substantive candidate review using the prepared Python3.13.15 environment with baseline dependencies and strict offline guards. Verdict pending; no acceptance or rollout claim.

Scoped Conductor receipt `.context/arb002-review-receipt-next-scope-receipt.json`, message `e3cd81d6-5b9b-4ef9-8617-15cffa8263ec`, confirms successful transfer and permits the same owner to draft only a bounded subsequent fill-outcome checkpoint in planning space. M1 remains frozen.

### Candidate01 verdict and candidate02 revision

Independent exact-head verdict **REQUEST CHANGES** after reproducing190 selected passes and the unchanged directional failure. Three material adverse probes failed: incomplete event cross-venue route can submit one leg; initial maker partial response can be lost when the next request is denied; new missing-input denial is swallowed by the legacy depth catch. [Review and runnable repros](../reviews/ARB002-M1-candidate-01-gpt.md).

Astra accepts a narrow revision on a new commit after8f0d935, preserving exactad37071 ancestry. Same sole Python owner; complete-route preflight, initial-response retention on denial, and named missing-market denial must receive failing-before/passing-after regression evidence plus affected suite. Existing financial arithmetic/schema/API versions remain outside this revision. Dispatch `e04f20a0-322d-43da-8a40-cdbbda25e89c`, receipt `.context/arb002-m1-revise-c02-receipt.json`. M2 remains planning-only until this revision passes.

### Candidate02 imported for independent recheck

Exact HEAD `2d1bcf6df6286d863e6e789de2cf776b76d9fa71`, parent `8f0d9359a871870f2f8a51d9718c5c90cf7c0b5b`, tree `278313f6bb455ce5a8feec303aae4e445eb3b57c`. Builder reports 71 revision and 261 affected passes at the committed head; separate historical directional suite remains 34 pass/1 fail. Evidence `docs/arbitrage/ARB002-M1-c02-evidence.md` is committed.

Root received both bundle parts, verified 10,147 bytes and SHA256 `648e9ba3b72eecebafa5524e7ac822a60fb91c3d27a7bfa76585161066d2b37b`, Git prerequisite/candidate ref, ancestry and clean detached `.context/arb002-review-c02`; ref `refs/reviews/arb002-m1-c02`. Stable independent reviewer `/root/arb_contract_check` owns the new-head delta review, original adverse repros and installed-dependency Python3.13 reproduction. Verdict pending. The source remains frozen while its separate planning worktree reconciles the next checkpoint.

### Completed offline milestone

Astra accepts M1 at exact `2d1bcf6df6286d863e6e789de2cf776b76d9fa71` after [independent candidate02 PASS](../reviews/ARB002-M1-candidate-02-gpt.md). Reviewer reproduced all261 affected tests with installed dependencies/Python3.13.15, the unchanged original adverse reproducer now passes allthree methods, and five further selected-venue positive controls pass. No material bounded-delta finding remains. Historical directional failure remains disclosed outside this pass; no full repository/live/deployed-compatibility guarantee. Source remains frozen and unpushed; next fill/accounting implementation awaits a concrete accepted ticket.
