# ARB005 Stage A candidate02 — independent review

**Bounded PASS. Both C01 findings are resolved; no remaining material reproducible finding in the reviewed Stage A scope.** Same stable independent GPT reviewer and same `entry_dispatch_check` critic. Fable has returned and leads RH002; this review is GPT continuity, not a new Fable pass or a claim that the prior quota outage continues. Acceptance/routing remains with root; Stage B and production are not authorized by this report.

## Exact candidate and continuity

- Tested HEAD `69f0f2b3fc3325e0b6c44229d4b09bc666260134`; immediate source parent `0783369aa8fe07eb67dc4e8a31b2385028848945`; full tree `9f57bd080c72d7fe4a4f1ef5c7227d1b8bde0231`. Source parent descends directly from frozen C01 `449d5ea6aa02d4aa183a2c7d174d9ac4197b042f`; final commit is evidence only.
- Clean detached worktree `/home/vercel-sandbox/neutralis-ai/.context/arb005-review-c02`; ref `refs/reviews/arb005-stage-a-c02`. Review began after root supplied verified custody, not a guessed checkout. Exact identity and clean source were checked independently before/after tests.
- Root verified complete 42,687-byte bundle SHA256 `ca83db21f3a9a6ed841355f745f5a7ded477f19af6efdb95c36949d7ba9c05fc`, sole C01 prerequisite, complete diff/tree/ancestry/scope custody: `.context/arb002-review-transfer/arb005-c02-custody.json`. Transport and original recovery custody remain attributed to root.
- Review covers the full Stage A acceptance scope through the prior complete C01 review plus the entire C01-to-C02 revision, not merely the final evidence commit. All three changed product files were read: `neutralis/execution/mode.py`, the two explicit metadata methods in `neutralis/storage/postgres.py`, and the bounded dependency-denial return in `scripts/run_once.py`. Changed test/provider seams and the complete 160-line candidate02 report were read before tests.
- Complete accepted c5bbaf3 contract remains byte-identical: 706 lines / 71,265 bytes / SHA256 `9e9f3625c4fb71a9b7cf3958820fc6aa908272dd558a4e446726cda6ff0090f0`. The accepted ARB005 ticket and current PROJECT/STATE/MEMORY were read; private scope snapshots retain this review's inputs.
- Frozen C01 main report SHA256 `9e7ba1a315acc7642e2c08c56a64c033fed2e5d77c5e85ef7db4a7207e7b0f97` and both original indexes were verified, including all 10 main and 8 critic entries. All four supplied original scripts are preserved byte-for-byte in the candidate's committed review copies and original C01 worktree. No prior report/source/evidence was overwritten.

## Finding closure and fixture review

**C01 F1, credential/account ownership: resolved.** `mode.py:119–177` now represents an explicit external associated provider and its returned immutable association/private single-use constructor. `mode.py:204–244` compares the original provider/factory/association and returned owner/run/provider/factory/association before registration or construction. The product no longer synthesizes an account-labelled resolution from loose configuration/per-user credential kwargs. The existing adapter consumes this resolution and retains its original handle checks. Polling's new named `ExecutionDenied` handling returns before admission with the original outcome sink halted; it does not continue through the remaining route.

The same critic's independent 16-case matrix covers both venues, both credential selectors, both real dispatchers and A/A versus A/B. Its private resolver imports no builder credential-double helper and contains no mismatch-denial rule: it returns the actual selected record plus a constructor passing those same private arguments into the fixed SDK/signer factory. Eight A/A cases construct and submit on A, persist both supported legs and complete; eight A/B cases reach product `CREDENTIAL_ASSOCIATION_MISMATCH` before target factory construction, any durable admission or order. Per-user lookup uses the exact run user once and ignores the deliberately unusable config key. The main reviewer inspected that script, result log and adaptation diff before collecting the critic's final PASS.

The authentic provenance of a supplied external provider is still a rollout dependency, not something these tests certify. The fixture does not supply ready-made entry permits, close operations or compare A/B on behalf of product code. A lying external provider is not claimed authenticated by this wrapper.

The preserved original account script was also executed unchanged: its two old A/A positive assertions fail because they construct a dependency without the now-required provider; its two A/B negatives pass, with all four cases denied before construction/orders. This is separately recorded as an obsolete-dependency audit, not presented as a green original run. The separate provider adaptation changes only the necessary external ownership seam, preserves the actual B key, fixed factory, A recording scope and all original positive/negative assertions, and passes all four cases. The independent 16-case matrix independently rules out blanket denial as the explanation.

**C01 F2, explicit metadata failure latch: resolved.** `postgres.py:807–865` and `867–914` validate the legitimate caller's original recording dependency, then cover connection acquisition, readback/closure, commit and cleanup with the existing calling-run failure latch. Invalid unrelated callers are rejected before this authority is established. Automatic and explicit callers now preserve the same uncertainty boundary; finite metadata readback remains possible after the stop.

The original 6,094-byte protocol script, SHA256 `2b71f16a6b3be79fc20eb7422ab216a3e3ceaea6477b8458a4fa058b7bb46d9b`, ran unchanged: all 12 cases pass. Each of its four former failures now reports the caller stopped, B unstarted and no new permit. The strongest case still loses acknowledgement after A's real effect and then after a newly committed closure; A's one acquisition and both caller halts remain intact. No economic retry or rearming is introduced.

Eight additional independent probes cover primary-identity/namespace-barrier faults in both metadata methods, a different reader failing against a genuinely still-owned original effect, and original metadata readback under revoked controls/stopped run. Only the failing reader halts; the legitimate other owner's effect still applies. Subsequent successful metadata readback cannot rearm the failed reader, and new observation registration stays denied before a cursor is opened. All eight pass.

The changed `test_still_live_backend_cannot_prove_effect_absence` expectation is justified by accepted contract lines487–493: the caller that receives the failed explicit readback must halt and cannot start its unused effect afterward. The original active-backend/no-closure assertions remain, followed by denial and explicit metadata noncommit closure after external backend quiescence. A separate different-reader positive preserves the original effect owner's valid liveness. This is a correction of the conflicting old expectation, not removal of required positive behavior.

## Exact-head execution

Interpreter `/home/vercel-sandbox/neutralis-ai/.context/arb002-review-venv/bin/python`, CPython3.13.15; installed unchanged requirements, including pytest9.1.1, psycopg3.3.5, httpx0.28.1, websockets16.1.1, cryptography46.0.7, py-clob-client0.34.6 and polymarket-us0.1.2. No package was installed/upgraded. `environment-and-custody.json` records full package metadata, exact source identity, unchanged inputs and original probe parity.

The strict runner was inspected again. Its bytes, requirements, root conftest and cursor double match C01; the changed provider/conftest inputs were inspected before imports. All product tests used this exact prefix from the candidate checkout:

```sh
unshare --user --map-root-user --net env -i PATH=/usr/bin:/bin /home/vercel-sandbox/neutralis-ai/.context/arb002-review-venv/bin/python -B tests/arbitrage/offline_runner.py --installed-dependencies --disable-plugin-autoload -q -p no:cacheprovider
```

| Suffix | Independently observed result |
|---|---|
| `tests/arbitrage tests/test_execution.py tests/test_portfolio_manager.py --tb=short` | 602 passed, exit0, 39.96s; `.context/reviewer/affected.log`. |
| `tests/arbitrage/.context/reviewer/test_protocol_review.py --tb=short -s` | 12 unchanged original probes passed, exit0, 0.39s; `.context/reviewer/original-protocol.log`. |
| `tests/arbitrage/.context/reviewer/test_c02_metadata_independent.py --tb=short -s` | 8 additional independent probes passed, exit0, 0.30s; `.context/reviewer/independent-metadata.log`. |
| `.context/entry-review/test_original_entry_paths.py .context/entry-review/test_start_fence_controls.py .context/entry-review/test_account_binding_provider.py --tb=short -s` | Same critic: 26 passed, exit0, 3.58s; `.context/entry-review/regression-provider-results.log`. Original16 and fence6 are unchanged; account4 has the reviewed provider seam only. |
| `.context/entry-review/test_independent_provider_routes.py --tb=short -s` | Same critic: 16 independent provider cases passed, exit0, 1.97s; `.context/entry-review/independent-provider-results.log`. |
| `.context/entry-review/test_account_binding.py --tb=short -s` | Same critic: 2 passed / 2 expected obsolete-positive failures, exit1, 0.48s; separately retained `.context/entry-review/original-account-denial.log` as explained above. |
| `tests/test_directional.py --tb=short` | 34 passed / 1 failed, exit1, 0.07s; `.context/reviewer/directional.log`. Historical `TestEvaluateDirectionalSignal.test_reject_duplicate_position`; test, actual directional scanner and guard source remain unchanged. |

The required affected suite and all 62 supported-input private probes pass (12 protocol + 8 additional metadata + critic42). No required Stage A skip/xfail or unexplained in-scope failure remains. This is not a green full-repository claim: the historical directional failure and literal old-provider audit are explicitly retained.

## Limits and frozen artifacts

The complete Stage A result uses real preparation, supported adapters, both bounded entry dispatchers, normalization, collector/facade and storage algorithm with external credential/client/signer/transport/control/connection/cursor doubles. Original quantity/unit/full checks, fixed authority, precise Q/C, complete zero/one/many operation results, uncertainty halts, preadmitted start fences and late-response ownership retain their required coverage. No fixture replaces the durable state machine or produces accepted permits directly.

SQL027 is byte-identical to C01 and remains unexecuted source. No SQL/database installation/start/use, Stage B runner/predecessor DDL, real SDK client/signer/key/account/venue/database/notification, service/daemon/polling loop, package changes, Conductor messages, source/shared-record edits or publication occurred. TCP/DNS/key-file/real-Postgres guards and the network namespace stayed in place. Synthetic cursor checks are not PostgreSQL constraint/numeric/locking/atomicity/concurrency/restart-durability proof; installed SDK imports do not certify serialization/signing/retries or deployed compatibility. Missing production provider/schema/version/writer provenance remains unavailable. Stage B, rollout, arbitrage publication and existing Railway/UI holds remain separate.

Collected final same-critic report `.context/arb005-c02-entry-critic.md`, SHA256 `67a5589c5b0aa1907ffc382b0c77247d1db8398f59a20a0a42fadd35719e234f`; index `.context/arb005-c02-entry-critic-manifest.json`, SHA256 `bbb315160865ef64fa975f00a6a89095503a4958b9a5da5d64a8f656f6340871`. Its complete artifact index was verified before this overall verdict. The main frozen index `.context/arb005-review-c02-independent-manifest.json` records this report, original/private probes, logs, scope/environment receipts, accepted contract and the critic index. All C01 evidence remains intact.
