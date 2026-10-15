# ARB004 proposal candidate01 — timing and recovery contract challenge

**REQUEST CLARIFICATION — two material protocol ambiguities before implementation.** Same independent GPT critic as the ARB003 entry review, under the reported Claude quota exception. This is a read-only documentation challenge, not execution evidence or a new Fable review.

Full proposal read: `docs/arbitrage/ARB-DURABLE-1-proposed-contract.md` at exact `a9e226a06f3e709bacb96256357b4d50284713e6`, parent accepted `edbe260cbd65313385e12fac212f9a1cbf50c8a0`. Verified 466 lines, 44,603 bytes, SHA256 `fb2b29e765be3c301ff056310353ca02d4be696609a72eb5f96056c33c1cf27b`. Proposal checkout is clean. Read-only source comparison used accepted `OutcomeRun` and execution-mode behavior to distinguish existing process-local halts from proposed durable guarantees. No source imports, tests, SQL, DB/network/service access or Conductor messages occurred. Prior candidate01/candidate02 evidence was not changed.

## 1. An ambiguous later observation has no specified durable attempt/closure discriminator

**Proposal anchors:** typed boundary lines 48–52; order state fields line 182; transaction/commit lines 308–310 and 318–330; promised restart barrier lines 333–341.

The proposal explicitly preserves a write/commit-uncertain attempt only in the original caller after loss (320–321), while saying an uncertain run cannot escape its halt through a new run/request identity (338–341). The listed durable fields contain admission/submission state, committed observations, committed application totals and committed halt reasons; the contract does not specify a durable discriminator for an observation attempt whose updated facts did not become visible. Capturing the attempt/backend identity at line 328 does not state where it survives the original process.

Concrete contract failure sequence:

1. An original order has an acknowledged, fully applied receipt, `entry_state=observed`, and no persisted halt reason.
2. Its original owner receives a later conflicting/alternate response. Recording that response starts a new owned transaction; its proposed observation/halt update has not committed.
3. Connection loss makes that transaction unknown to the caller. The server ultimately rolls it back, or the caller disappears before establishing its result. The proposal correctly forbids guessing rollback and keeps the original run halted in memory.
4. Durable rows now look exactly like the earlier clean, completed order. A new process admits another request under the same scope. Neither the namespace lock nor a read of the old completed receipt identifies the missing later attempt or supplies its identity for the required reconciliation. Thus the stated unresolved-prior-attempt barrier has no specified durable predicate in this sequence.

The simpler successful-commit/lost-acknowledgement case also needs an explicit rule: a durably full row is not by itself proof that an independent reconciliation step occurred for the lost acknowledgement. A readback may establish the result, but the proposal must identify that readback and what exact attempt it closes rather than silently treating generic old totals as closure.

The singular reconciliation interface compounds this timing ambiguity. `reconcile_entry_application(..., application_key, attempt)` returns a single economic receipt (line 52), whereas an observed-only/ID-only response may produce no application key and a US response transaction may produce several (49–50,167–168). Admission already has an identical-intent resolution route (46,101–102), so this is not a claim that admission reconciliation is impossible. The missing clarification is how the attempted operation and its complete zero/one/many-key outcome are identified and resolved without mistaking an older individual receipt for proof of the entire attempt.

**Minimal clarification:** define the exact durable attempt/closure or conservative unresolved-state discriminator, its timing relative to each potentially uncertain observation transaction, and the admission/start predicate that consumes it. Define the reconciliation identity/result for an operation producing zero, one or multiple acquisitions, including what remains permanently unresolved when its original provenance cannot be recovered. Use the existing tables/owned protocol scope; this finding does not request another ledger, automatic retry, scheduler or rollout. Add the prior-completed-order/later-uncertain-observation crash sequence and zero/multiple-acquisition lost-acknowledgement cases to the proposed finite acceptance matrix. Merely repeating the run-wide halt requirement does not supply the durable predicate.

## 2. A previously admitted intent can bypass the later unresolved-scope admission check

**Proposal anchors:** one-use start operation line 47; separate admission/start timing lines 104–107; not-started state line 112; namespace serialization and admission check lines 288–299; later admission restriction lines 338–341.

The namespace lock explicitly protects admission's unresolved-prior-scope check. The separate start operation is described as a one-use admitted-to-submission_started transition. Its specified preconditions require the original admission/start acknowledgements and ordinary exact-user controls, but do not require a fresh unresolved-scope predicate at the start transition.

Concrete contract failure sequence:

1. Two independently owned plans A and B in one user/account/subaccount/venue/mode namespace are admitted while neither has a started or unresolved submission. B retains its valid unused admission acknowledgement.
2. A starts and subsequently has an unresolved submission or application. Ordinary user controls can still report running; A's process-local unknown flag is not B's flag.
3. B now calls `mark_entry_submission_started` with its earlier admission. A check performed only at B's earlier admission cannot see A's intervening unresolved state. The specified one-use transition and ordinary controls can pass, allowing B to submit without the reconciliation required for a newly admitted plan in the same situation.

Acquiring the namespace lock at both operations does not resolve this by itself: the start transaction must actually re-read and enforce the durable unresolved-state predicate. This sequence is about B not yet having obtained a start acknowledgement when A becomes unresolved; it does not ask the implementation to retract an already-started venue call or discard late responses.

**Minimal clarification:** explicitly require the unresolved-scope/attempt check under the namespace lock during every not-started-to-started transition, including pre-admitted intents and explicit replay, and name the existing-plan exception, if any, that preserves only genuinely already-started work. Specify that a previously issued admission alone cannot authorize this transition after a blocking scope change. Include a two-owner pre-admit A/B → unresolved A → attempted start B acceptance case. Preserve existing M1 controls and original response delivery; no lock needs to span venue I/O and no new automatic recovery is requested.

## Other bounded protocol conclusions

The proposal does clearly separate durable intent from start and economic effects; forbids automatic resubmission and caller-supplied deltas; owns a dedicated top-level transaction/connection; orders namespace/order/position locks; retains original late-response dependencies; distinguishes control revocation from untrusted storage; and rejects absence-only rollback inference while an old backend may still commit. Its explicit backend identity/quiescence plus primary lock barrier is stronger than merely opening a new connection. These are documentation contracts only, not PostgreSQL or production validation.

Schema/cardinality/precision, adapter-account provenance and final scope acceptance are owned by the main review. No further sweep or implementation was performed here. Verdict remains **REQUEST CLARIFICATION** for the two timing/attempt-state gaps above; implementation and disposable database Stage B remain unassigned.
