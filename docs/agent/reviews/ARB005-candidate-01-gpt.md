# ARB005 Stage A candidate01 — independent review

**REQUEST CHANGES: two material findings.** Same stable independent GPT reviewer and same bounded entry critic, under the continuing founder-reported Claude quota exception. This is not a new Fable review. Stage B and production remain unassigned.

## Exact candidate and reviewed scope

- HEAD `449d5ea6aa02d4aa183a2c7d174d9ac4197b042f`; immediate parent `724a397fda6e6ee30a18d7d4b6fa421ec0b22765`; tree `552bbdb5480946d4b4fbaac827b9be9b18e24618`.
- Clean detached checkout `/home/vercel-sandbox/neutralis-ai/.context/arb005-review-c01` before and after review. Reviewed the complete accepted `c5bbaf306f4e7768c61458318dcc9087a4ea7834` to HEAD delta, including source commit c70107b and both evidence children, not only the last evidence commit.
- Governing ticket: root `docs/agent/tasks/ARB005-durable-entry-stage-a.md`; complete accepted contract `docs/arbitrage/ARB-DURABLE-1-proposed-contract.md`, 706 lines / 71,265 bytes, SHA256 `9e9f3625c4fb71a9b7cf3958820fc6aa908272dd558a4e446726cda6ff0090f0`. Current PROJECT/STATE/MEMORY and builder implementation/candidate/dispatch evidence were read.
- Root independently owns imported bundle/recovery ancestry/allowed-file custody checks in `.context/arb002-review-transfer/arb005-c01-custody.json`. Reviewer directly checked exact Git identity, clean source and the complete product delta; no source or shared record was edited. Earlier accepted source and review artifacts remain preserved.

## 1. High: config credentials can select account B under account A's admitted association

Source: `neutralis/execution/mode.py:178–224`, especially lines188–200 and218; adapter consumption at `neutralis/execution/polymarket_us.py:57–64`. Accepted contract lines68–105, particularly79–92, requires an associated provider-owned construction resolution; unlabelled credential kwargs or separately supplied config credentials cannot establish account ownership.

`resolve_for_adapter` creates a new wrapper around the already-labelled owner, but gets the credential material from caller-supplied `settings.execution` or a plain per-user dictionary. No resolver-returned association/revision is compared with the recorded owner. Factory object identity and the later client handle check therefore preserve whichever account the supplied key selected, including the wrong one.

The same critic independently reproduced this through both actual event and polling entry paths. A single unchanged synthetic US factory selects external client A or B from its incoming key. The prepared owner's association and recording dependency stay account A. Passing config key B selects client B; real admission, final start, US SDK-double order and Kalshi continuation all succeed; the US trade is written with A's original account scope. Both traces end `unresolved=False`, `issues=[]`. Corresponding A/A controls pass. No actual account, secret or client was used. The main reviewer inspected this probe, its log and the relevant product path. The unlabelled per-user branch is a source observation, not an additional separately reproduced failure.

Reproduction: `.context/entry-review/test_account_binding.py`, log `.context/entry-review/account-results.log`: **2 failed / 2 passed**, exit1, 1.20s. The two failures are one defect across both dispatchers.

Required correction: make the actual associated dependency supply its private, single-use construction resolution with the matching immutable association/revision before complete-plan admission. Reject an unassociated config/per-user credential selection; do not treat a new wrapper around a caller label as proof. Preserve the valid A/A path, unchanged payload/auth interfaces, original late-response ownership and zero admission/order/economics for mismatched A/B. This requests the already accepted seam, not account onboarding, secret persistence or new venue calls.

## 2. Medium: explicit readback/closure failure does not halt its calling run

Source: `neutralis/storage/postgres.py:807–854` and `856–892`. Both public metadata methods only close their connection in `finally`; neither latches the supplied calling run on failure. Their automatic admission/start/application callers do latch failures, but the explicit reconciliation/closure boundary is separately accepted and lacks that protection. Accepted contract lines487–493 explicitly requires readback/closure loss itself to stop its caller and keep new admission/start/observation/economic work denied.

The strongest independent probe uses a newly committed closure, rather than only rereading an old one:

1. Admit A and B under separately active runs with the same synthetic account namespace; start A.
2. Apply A's actual full observation; its effect commits but its acknowledgement is lost. A stops, exactly one acquisition remains, and its durable operation is `result`.
3. B's run explicitly calls `reconcile_entry_operation` for that original operation. The real complete readback and metadata closure execute. Inject acknowledgement loss immediately after that new closure commits.
4. B receives the failure but stays unstopped. `start_durable(B)` then executes the real final predicate, records B started, and returns a usable submit permit. A remains stopped and the original acquisition remains exactly one.

Observed trace: `original_a_stopped=true`, `reconciling_b_stopped=false`, `prior_effect_phase=closed_committed`, `next_b_start_denied=false`, `later_permit=true`. The probe does not use that permit to issue another adapter order. Three additional direct metadata read/commit-failure probes show the same missing caller latch; a successful-readback positive permits the valid later start.

Reproduction: `tests/arbitrage/.context/reviewer/test_protocol_review.py::test_lost_new_closure_ack_does_not_allow_reconciling_run_to_start` and the three `test_metadata_failure_latches_calling_run_before_next_start` cases. Final log `.context/reviewer/protocol-review-final.log`: **4 failed / 8 passed**, exit1, 0.54s. All four failures describe this one defect. Earlier 3-failure exploratory log is retained separately and is not the final count.

Required correction: enforce the supplied caller's persistent in-process uncertainty/outbound/write latch at the explicit readback/closure boundary when those operations fail, including connection/read/commit acknowledgement failures, while retaining finite metadata readback/closure as the permitted exception. A later successful closure must not revive that caller; preserve original economic facts and allow valid successful-readback controls. Do not add economic retry or a reconciliation scheduler.

## Executed proof and boundaries

All product imports/tests used this exact checkout and the inspected strict runner, installed unchanged requirements, sanitized environment, network namespace and external doubles. The shared conftests and new cursor implementation were inspected before execution. The cursor double stores SQL statement arguments, projects rows and models transaction acknowledgement faults; admission, registration, source normalization, acquisition arithmetic, whole-result readback, closure and final start predicates execute in product code. It does not execute SQL or implement its constraints/locks.

Interpreter: `/home/vercel-sandbox/neutralis-ai/.context/arb002-review-venv/bin/python`, CPython3.13.15; pytest9.1.1, psycopg3.3.5, httpx0.28.1, websockets16.1.1, cryptography46.0.7, py-clob-client0.34.6, polymarket-us0.1.2. Full installed-package/input receipt: candidate `.context/reviewer/environment.json`. No dependency installation or change.

From the candidate checkout, every test command used this prefix:

```sh
unshare --user --map-root-user --net env -i PATH=/usr/bin:/bin /home/vercel-sandbox/neutralis-ai/.context/arb002-review-venv/bin/python -B tests/arbitrage/offline_runner.py --installed-dependencies --disable-plugin-autoload -q -p no:cacheprovider
```

| Command suffix | Result and evidence |
|---|---|
| `tests/arbitrage tests/test_execution.py tests/test_portfolio_manager.py --tb=short` | 543 passed, exit0, 38.24s; `.context/reviewer/affected.log`. |
| `tests/test_directional.py --tb=short` | 34 passed / 1 failed, exit1, 0.07s; `.context/reviewer/directional.log`. Historical unchanged `TestEvaluateDirectionalSignal.test_reject_duplicate_position`; test/scanner/guard source unchanged against accepted base. This is not a green full repository result. |
| `tests/arbitrage/.context/reviewer/test_protocol_review.py --tb=short -s` | 4 failed / 8 passed, exit1, 0.54s; final independent protocol log above. |
| `.context/entry-review/test_original_entry_paths.py --tb=short -s` | Same critic: 16 passed, exit0, 2.90s; `.context/entry-review/original-entry-results.log`. |
| `.context/entry-review/test_account_binding.py --tb=short -s` | Same critic: 2 failed / 2 passed, exit1, 1.20s; account log above. |
| `.context/entry-review/test_start_fence_controls.py --tb=short -s` | Same critic: 6 passed, exit0, 0.55s; `.context/entry-review/start-fence-results.log`. |

The required suite exercises the Stage A groups: event duplicate/conflict, fixed cumulative Q/C, alternate evidence, explicit scopes and legacy denial, exact fractional/range arithmetic, registered-operation and rollback boundaries, complete zero/one/many manifests, effect/closure acknowledgement loss, original backend fencing, preadmitted B/start sequencing, genuine outstanding responses and inactive-mode suppression. Its passing count does not close the two independently reproduced gaps.

Independent additional positive probes cover old and latest cumulative-snapshot replay with current acknowledged totals, first/last/both multi-event receipt replay without duplicate acquisitions, acknowledged versus lost registration readback without rearming, successful metadata readback followed by valid start, and final-start denial after A's later uncertain operation in either B-registration order. The original ARB003 quantity/unit/partial/late-response expectations are preserved through the explicit Stage A fixture adaptation. The critic's report documents the original/adapted probe fingerprints and extraction/receipt seam changes.

Migration027 was read as unexecuted source. No SQL, PostgreSQL install/start/use, predecessor DDL or Stage B runner was executed or created. Static schema source and synthetic row arguments are not PostgreSQL FK/NULL/numeric/locking/atomicity/concurrency/crash-durability proof. Installed SDK imports are not real serialization/signing/retry/vendor compatibility proof. No real credentials/accounts/venues/database/notifications, daemon or polling startup, external service, Conductor message, source change, publication or deployment occurred. Real external clients, signers, transports, control providers and storage are doubles; the strict runner and network namespace remain intact.

The candidate stays frozen and unaccepted pending same-owner revision. Preserve all existing Railway/UI publication holds and the separately unassigned Stage B boundary. Only root reconciles this verdict and dispatches revisions.

Frozen same-critic report: root `.context/arb005-entry-critic.md`, SHA256 `37f6050aa75ef7d48b4806f919be6fdda29e8ea5c599285fd540cb69b4ea68d0`; critic manifest `.context/arb005-entry-critic-manifest.json`, SHA256 `0a414e822b1699611510d3eaee1c9d70e33f78725d2953387b94ade09e6d0c12`. The main manifest `.context/arb005-review-c01-independent-manifest.json` records this report, all main private probes/logs/environment, the exact accepted contract and the verified critic index. It is the final byte-custody record for this review.
