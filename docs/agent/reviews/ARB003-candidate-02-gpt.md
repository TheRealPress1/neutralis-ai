# ARB003 / ARB-FILL-1 candidate02 independent review

**PASS for the bounded offline checkpoint. No material reproducible findings remain in this review.** The two candidate01 completion defects are corrected without discarding supportable fills or changing request sizing/routing. This is a same-family GPT review during the continuing founder-reported Claude quota exception, not a new Fable pass. The same replacement reviewer and same bounded entry-route critic reviewed the revision, preserving candidate01 findings and evidence.

## Exact candidate and review scope

- HEAD `edbe260cbd65313385e12fac212f9a1cbf50c8a0`; direct parent `232fe82e00698776caf73c9b45cdff3f5319f22f`; tree `73bb15b599416260905654b49c8c46fec9f73036`.
- Clean detached checkout `/home/vercel-sandbox/neutralis-ai/.context/arb003-review-c02`. Accepted M1 `2d1bcf6df6286d863e6e789de2cf776b76d9fa71` and recovered exact `ad37071ae6bbc4a31289f9e662388c50e92ac3d3` remain ancestors.
- This review combines the preserved full M1-to-candidate01 review with the complete candidate01-to-candidate02 revision and exact-head affected tests. The revision changes six files. Product changes are confined to `neutralis/execution/outcomes.py` (+18/-1); the other files add 24 permanent regressions and documentation/exact prior review/repro copies. Adapters, runtime routing, PortfolioManager, storage, schemas, configuration, requirements, guards/scanners, source fixtures and offline harness remain unchanged from candidate01.
- Root independently verified bundle/ref/tree/ancestry, full diff hashes and exact accepted-contract/prior-report/repro parity in `.context/arb002-review-transfer/arb003-c02-verified-custody.json`. Unchanged source provenance retains the previous independent schema/package checks; no new public-source lookup was needed.

## Closure of the two findings

**Original quantity and completion:** the Kalshi decoder now retains supported execution evidence while flagging an echoed initial quantity that conflicts with the original request. Its full-completion gate requires the admitted immutable binding, the original contract amount, acknowledged totals and complete source evidence. Both unchanged original event/polling probes now submit only the first count-2 order, record the supported one-contract execution and keep the run unresolved. The contradictory response can no longer authorize the next count-2 leg. Permanent regressions also cover larger echoed initial quantities, overfill retained with unavailable projection, faithful partial and canceled remainder, and valid original-size completion.

**Supplied complementary units:** whole-plan validation checks known contract quantities after the existing independent caps. The original $0.95 cap case now rejects before request admission, submission or entry writes. It reports `CONTRACT_EXPOSURE_MISMATCH`; it does not resize orders or hedge. Valid equal-unit cap controls, uncapped complete routes and real single-leg directional selection continue to work. USD-sized US entries retain their existing receipt-based comparison against the original Kalshi quantity.

**Retention and immutable admission:** independent narrow probes show a later supported complete snapshot still applies its legitimate delta after partial/conflicting completion halted entries, but cannot revive the halted route. The final position retains all five observed contracts/$2.30 from two acknowledged deltas. Passing a relabelled amount, user or run to `full()` cannot alter the admitted request or regain completion. Unchanged original authority/arithmetic/uncertain-storage probes remain passing, including original late SDK futures after acknowledged trade/failed position writes.

## Exact-head verification

All commands ran from the C02 checkout using the inspected unchanged runner, task-local CPython 3.13.15 and unchanged installed dependencies. Common prefix:

```sh
unshare --user --map-root-user --net env -i PATH=/usr/bin:/bin /home/vercel-sandbox/neutralis-ai/.context/arb002-review-venv/bin/python -B tests/arbitrage/offline_runner.py --installed-dependencies --disable-plugin-autoload -q -p no:cacheprovider
```

Append these selections:

| Selection | Result | Evidence relative to C02 checkout |
|---|---|---|
| `tests/arbitrage tests/test_execution.py tests/test_portfolio_manager.py --tb=short` | exit 0; **424 passed**, 13.76 s | `.context/independent/affected.log` |
| `tests/arbitrage/.context/reviewer/test_review_outcomes.py tests/arbitrage/.context/reviewer/test_review_completion.py --tb=short` | exit 0; **21 passed**, 0.17 s: unchanged original 16 plus five narrow completion probes | `.context/independent/outcomes-completion.log` |
| `.context/entry-review/test_entry_paths.py --tb=short -s` | exit 0; **16 passed**, 2.58 s; original script byte-identical | `.context/entry-review/original-results.log` |
| `.context/entry-review/test_revision_controls.py --tb=short` | exit 0; **8 passed**, 2.62 s; independent receipt/equal-unit/single-leg controls | `.context/entry-review/controls-results.log` |
| `tests/test_directional.py --tb=short` | exit 1; **34 passed, 1 failed**, 0.09 s | `.context/independent/directional.log` |

No required skips or xfails. The historical directional failure remains `TestEvaluateDirectionalSignal.test_reject_duplicate_position`, expecting reject but receiving pass. Its test, guard and scanner source are unchanged against M1 and both candidates; it is reported separately, not hidden or treated as a green full-repository suite.

The unchanged original entry repro is 7,390 bytes, SHA256 `515c888b3819869f52a076790b3d6ccfab84722f25b2a46ab078d5aca66f15f2`. The unchanged original 16-outcome script SHA256 is `574c061dc656bb9da5312ebe65e0afe87ab6658d3b5db354e29d2c68cfac4571`. Candidate01 evidence remains intact. The final same-critic entry review is PASS with no material findings: `.context/entry-review/REVIEW.md`, SHA256 `f3e3568a5519a3176d3832eeed35abfbd058d7cd6835004169b237dda624008e`; its manifest SHA256 is `7adbb26d528d747a9a4e69829eebaf58faa9143bb0de30cfde4d28782225a96c`. Final artifact hashes and commands/results are in the accompanying independent manifest and the entry critic's report/manifest.

## Limits

Network namespace and pre-import TCP/DNS/key-file/environment/Postgres guards were active. Preparation, scoring/dispatch, permission gates, adapter payload/response handling and PortfolioManager were actual product code; external transport/SDK/signing/storage/control dependencies were inspected doubles. International SDK value constructors remain doubles. All review files are private `.context` artifacts; product and shared orchestration records were not edited by reviewers.

This establishes the accepted run-local offline entry-outcome contract. It does not prove deployed SDK serialization/signing/retries or venue compatibility, production database precision/atomicity/concurrency, durable idempotency, restart replay, fees/net P&L or actual exits. International positive-quantity/action projection and US NO execution consideration remain explicitly unavailable. No real account/venue/DB call, daemon/polling loop startup, database application, push, deployment or production operation occurred.

Root may reconcile the bounded checkpoint as accepted. Preserve the exact recovered fix, prior evidence, same sole implementation owner, deferred compatibility/accounting work and Railway publication hold. This PASS grants no arbitrage rollout, live order or publication authority.
