# ARB004 / ARB-DURABLE-1 proposal candidate01 contract review

**REQUEST CLARIFICATION / REVISE before implementation dispatch.** Three material protocol decisions remain underspecified. This is a read-only review of a proposed contract, not a test failure or a finding against accepted ARB003 source. Same-family GPT review under the continuing Claude quota exception; the same reviewer and bounded protocol critic retained continuity.

## Exact artifact reviewed

- Proposal HEAD `a9e226a06f3e709bacb96256357b4d50284713e6`, direct parent accepted ARB003 `edbe260cbd65313385e12fac212f9a1cbf50c8a0`, tree `e62c6b2b0aec99bdf69169a69026bf206d0e0d61`.
- Clean detached checkout `/home/vercel-sandbox/neutralis-ai/.context/arb004-proposal-c01`.
- Read all **466 lines / 44,603 bytes** of `docs/arbitrage/ARB-DURABLE-1-proposed-contract.md`, SHA256 `fb2b29e765be3c301ff056310353ca02d4be696609a72eb5f96056c33c1cf27b`.
- Read the current root profile/state/index and accepted documentation-only ARB004 ticket. Compared relevant accepted model/outcome/PortfolioManager/adapter/storage and migration definitions as text only. Root independently checked bundle and source-only custody.

The proposal correctly separates intent, submission, observation and economic application; preserves fixed authority and exact Q/C; names a bounded four-table schema, owned transaction and concurrency protocol; and distinguishes Stage A external-double proof from separately unassigned Stage B PostgreSQL proof. Its precision, legacy freeze and non-production limits are explicit. These strengths do not settle the three gaps below.

## 1. Durable account scope is not yet bound to the actual venue dependency

**Proposal anchors:** lines44,61–67,77–96,104–106,124–126,354–360.

`DurableAccountScope` comes from the original recording dependency, and storage validates against that scope. The proposal does not define the evidence or invariant linking that namespace/subaccount to the actual adapter credential/client route that submits the order. Comparing ticker/action/amount and serialized payload cannot establish account identity.

Concrete contract trace: for one valid user, the storage dependency attests account A while the existing US credential/client dependency targets account B. The request payload and US returned order/executions match the admitted instrument/action/quantity; neither carries a checked account identifier. Every stated storage-scope and payload check can pass while the economic rows are labelled account A although the request operated in B. The current accepted `PreparedExecutionRun` stores `adapter_factories` and `live_storage_factory` independently (`neutralis/execution/mode.py:238`); US `for_run` separately chooses config/per-user credentials (`neutralis/execution/polymarket_us.py:75`), and its decoder checks order/instrument/action rather than a response account (`neutralis/execution/outcomes.py:220`). Supplying a recording label alone does not connect these facts.

Minimal clarification: specify the immutable provenance/association contract connecting the recording account scope, original credential route and adapter dependency before admission/submission, and the rejection behavior when that association is unknown or mismatched. State the narrow source boundary needed to enforce it. Add an offline mismatched-dependency case using the same user and a US response without account fields, plus a correctly bound positive. This asks for an explicit dependency contract; no credential values, account calls, key replacement or broad credential redesign is needed.

## 2. Persisted state cannot yet identify an unresolved acknowledgement across a new run

**Proposal anchors:** lines47–52,109–117,182,196–200,318–341; acceptance403/405.

The contract promises that a new run/request cannot escape a prior application-unknown halt, but the listed durable state and lookup interface do not establish which prior attempt needs reconciliation or what counts as its independent closure. It explicitly forbids a guessed post-loss write and retains the attempt in process memory. A committed acquisition with a lost acknowledgement can therefore have the same stored order/fills/totals/halt fields as an acknowledged successful acquisition.

Concrete contract trace: order A's full supported application commits; its acknowledgement is lost and the process remains application-unknown or dies. The durable row is observed/full with no persisted halt from the lost acknowledgement. A fresh process proposes order B with new signal/request IDs. The required unresolved-prior-scope query is not defined sufficiently to distinguish A from a clean completed order. A later ambiguous observation attempt on an already-completed order has the same problem if its new halt/observation never commits. Treating every such row permanently unresolved would also need an explicit policy; the document currently claims independently established reconciliation can resolve the condition.

The singular `reconcile_entry_application(... application_key, attempt)` result also needs to fit the facts being reconciled: an admission/start or observed-only commit may have no economic application key, while one US observation transaction may create several. Admission's identical-intent replay provides part of this story, but the complete operation/observation result and closure predicates are not specified.

Minimal clarification: define the durable discriminator or deliberately conservative readback policy used by new admission/start, the original operation/observation identity that is reconciled, and the result that establishes closure for zero/one/multiple applications. Include acknowledged success versus lost acknowledgement and later uncertain observation traces. Preserve the original run's halt and prohibit blind replay/resubmission; no new competing ledger is requested.

## 3. A previously admitted order can start after its scope becomes unresolved

**Proposal anchors:** lines46–47,104–107,112–113,288–299,333–341.

The unresolved-prior-scope check is attached explicitly to admission. The separate one-use `mark_entry_submission_started` transition requires the original admission/start acknowledgement and ordinary exact-user controls, but does not explicitly recheck the durable unresolved-scope predicate under its namespace lock.

Concrete contract trace: plans A and B receive admission while no prior submission is unresolved. A then starts and becomes unresolved. B retains its earlier admission; its process's ordinary M1 controls still say running. Checking only B's unused start marker permits its transition and adapter call despite A's unresolved state. No duplicate start or newly minted admission is needed. This concerns an admission that predates the failure, so adding only a fresh-admission check does not close it.

Minimal clarification: make the relevant durable unresolved/attempt predicate part of the serialized start transition as well, define exclusions for the selected plan's own never-started intents, and require a finite two-process/interleaved test. Preserve already-started response delivery. Do not imply a global zero-race guarantee across a database commit and venue call; state the start transition's precise authorization point and boundaries.

## Evidence, scope and verdict

The same bounded critic independently reviewed timing/crash/lock/reconciliation sections; its report is `.context/arb004-protocol-critic.md`, SHA256 `517cf2d420627a70324ea5a52ac5a674e9c1881960a335576e9ba323b403d634`. The main reviewer assessed account identity, schema/cardinality, precision, compatibility and actual integration. The failure sequences above are static contract traces, not executed SQL or runtime reproductions.

No product/test code was imported or executed; no tests, network/vendor lookup, SDK/client/signer, credential read, database installation/start/use, SQL application, daemon/polling loop, Conductor message, shared-record edit or publication occurred. Only private review artifacts were written. Prior ARB003 candidates, reports and hashes remain frozen. Stage A code and Stage B database work remain unassigned, and no production readiness is inferred.

Return these three bounded decisions to the same documentation owner, then review the complete corrected proposal and its exact hash. No founder permission question is needed to finish this documentation revision. **Verdict: REVISE proposed contract; do not dispatch implementation from candidate01 yet.**
