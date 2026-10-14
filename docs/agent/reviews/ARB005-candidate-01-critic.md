# ARB005 Stage A candidate01 — independent entry critic

Verdict: **REQUEST CHANGES — one material account-association finding**, independently reproduced through both actual entry dispatchers. Same-family GPT review under the established Claude quota exception. This bounded report does not decide the main review's storage/closure findings or authorize publication, Stage B, database work or live operations.

## Exact candidate and boundary

- Clean detached checkout: `/home/vercel-sandbox/neutralis-ai/.context/arb005-review-c01`.
- Tested HEAD `449d5ea6aa02d4aa183a2c7d174d9ac4197b042f`; parent `724a397fda6e6ee30a18d7d4b6fa421ec0b22765`; tree `552bbdb5480946d4b4fbaac827b9be9b18e24618`.
- Accepted full base `c5bbaf306f4e7768c61458318dcc9087a4ea7834` is an ancestor. Product status was empty before and after the checks.
- Read the accepted ARB005 ticket, complete accepted 706-line durable contract and relevant real preparation, factory, adapter, dispatcher and durable start/collection code. The candidate contract remains 71,265 bytes, SHA256 `9e9f3625c4fb71a9b7cf3958820fc6aa908272dd558a4e446726cda6ff0090f0`.
- Inspected the strict runner, fixture preparation and new cursor double before executing tests. Fixtures replace external cursor/transport/client boundaries. Admission, operation registration, effects, closure, start permits, adapter payload handling and outcome decisions execute the candidate algorithms. No fixture supplies ready-made permits or implements the closure state machine.

## F1 — configuration credentials are not bound to the asserted account association

**High priority.** `neutralis/execution/mode.py:178–223`, especially lines 188–200 and 218, builds the private resolution from whichever loose credential kwargs/current settings the adapter supplies. `require_original` at lines 162–176 checks descriptor, selector and factory object identity; it never compares an actual credential resolver's returned association or credential-record revision. `neutralis/execution/polymarket_us.py:55–61` passes the independently supplied execution configuration into that resolution. The resulting adapter owner/handle checks preserve the already-mismatched client. Actual callers proceed through `neutralis/engine/event_loop.py:2019–2082` and `scripts/run_once.py:744–766`.

Failure sequence reproduced separately for event and polling:

1. Keep one original Polymarket US account-A association and its recording dependency, plus one exact pinned client factory. Synthetic durable account A is `synthetic-account-polymarket_us`.
2. The synthetic factory chooses account A for `synthetic-key-A` and B for `synthetic-key-B`; the factory object itself is unchanged. Its SDK doubles record which account receives `orders.create`. No real credentials or account clients are involved.
3. Pass settings containing the synthetic B key/secret through the actual supported adapter construction path while the established association/recording scope still identifies A.
4. Both dispatchers construct SDK B, authorize and call its order method, and persist the supported US fill under durable account A. Each route finishes `unresolved=False`, `issues=[]`.
5. Identical A/A positive controls select SDK A, record A and finish normally.

The two negative cases fail the expected denial assertion; the two positive controls pass. This is one defect across two runtimes. It violates accepted contract lines 79–92: the actual resolver's association must be compared with the pinned descriptor, arguments must come from that same resolved owner, and unlabelled credential kwargs plus a separate account label are insufficient. Same generic factory identity cannot establish which credential/account it constructs. The source's per-user branch likewise accepts unlabelled dictionaries, but **only the configuration A/B route was independently executed here**; this report does not claim a separate per-user reproduction or production credential verification.

Required correction: make the original dependency's privately supplied resolution establish the association for the credentials actually consumed, enforce descriptor/revision agreement before any plan admission/order, and deny unassociated configuration/kwargs routes. Keep a legitimate associated positive path. No secret material belongs in bindings, receipts or evidence.

Probe: candidate `.context/entry-review/test_account_binding.py`; exact log `account-results.log`: **2 failed, 2 passed in 1.20s**, exit 1. Printed receipts identify selected synthetic A/B, actual SDK order account, recorded account, unresolved flag and issues.

## Completed bounded controls

**Original 16 entry probes, meaning preserved: 16 passed in 2.90s, exit 0.** Candidate `.context/entry-review/test_original_entry_paths.py` is the committed Stage A adaptation copied without changes. Compared with the frozen ARB003 C02 original, SHA256 `515c888b3819869f52a076790b3d6ccfab84722f25b2a46ab078d5aca66f15f2`, all original parameter cases and behavioral assertions remain: contradictory initial quantity, unequal complementary units, first US receipt retention through five later Kalshi outcomes in each runtime, and two actual pending US timeout/future paths. Changes are path resolution, durable row observations replacing forbidden legacy helper calls, the actual observation effect-commit callback replacing the legacy position-save acknowledgement callback, and the new external context-exit observation. The future test still waits on the original collector lock, requires the original binding and applied receipt, verifies one external submission and final unresolved halt, and retains storage until late collection. The reviewed adaptation diff is retained as `original-probe-adaptation.diff`. The fixtures' valid nonzero UUID and external cursor seam are Stage A dependency adaptations; no old behavioral failure expectation was weakened.

**Independent final-start fence controls: 6 passed in 0.55s, exit 0.** `test_start_fence_controls.py` pre-admits A and B under the same account scope, executes A's real adapter against HTTP double, records A's full fill through the real durable path, and later supplies an identical benign replay. B's start operation is registered either before or after that replay. With a commit-before or commit-after fault at A's observation result, A is application-unknown and run-halted; B's real final start transition denies with `DURABLE_SCOPE_BLOCKED`, has no permit/start timestamp and makes no second external submission. A's first quantity 5 / consideration 2.30 and single trade remain. With acknowledged replay, B legitimately gets a real permit and submits, with no A halt. These are ordered algorithm interleavings with external transaction doubles, not PostgreSQL lock/concurrency proof.

Total independently executed critic cases: **24 passed, 2 failed**, the failures both F1. No additional material finding in this slice. The main review separately owns its complete baseline and metadata/transaction/closure coverage; their results are not relabelled as my execution.

## Reproduction and limits

Run each listed script from the exact candidate checkout with this prefix; select `test_account_binding.py`, `test_original_entry_paths.py` or `test_start_fence_controls.py` respectively:

```sh
unshare --user --map-root-user --net env -i PATH=/usr/bin:/bin /home/vercel-sandbox/neutralis-ai/.context/arb002-review-venv/bin/python -B tests/arbitrage/offline_runner.py --installed-dependencies --disable-plugin-autoload -q -p no:cacheprovider .context/entry-review/test_account_binding.py --tb=short -s
```

Actual interpreter is the supplied task-local installed-dependency Python 3.13.15. Network namespace plus strict pre-import guards deny TCP/DNS, real DB, key files and implicit external clients. No real SDK client, signer, credentials, database connection or SQL execution, account request, service, daemon, polling loop, Conductor message, product edit, prior-evidence overwrite, Git publication or deployment occurred. Polling coverage calls the bounded existing dispatcher function, not a polling loop. External cursor projections do not prove real SQL syntax, database constraints, locks, serialization, numeric enforcement, backend quiescence or production compatibility; Stage B remains unassigned.

All new scripts, logs and adaptation evidence are frozen in candidate `.context/entry-review/`; their bytes/SHA256 and this report are recorded in root `.context/arb005-entry-critic-manifest.json`. Prior ARB003/ARB004 reports and probes remain unchanged.
