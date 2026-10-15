# ARB003 / ARB-FILL-1 candidate01 independent review

**REQUEST CHANGES — two material completion defects reproduce through both actual entry runtimes.** This is an independent same-family GPT review during the founder-reported Claude quota exception, not a new Fable pass. The prior stable reviewer could not resume because its thread limit was reached; this reviewer consumed its preserved adversarial review plan and the full accepted contract. A bounded read-only child checked actual dispatch while this reviewer checked source decoding, authority, PortfolioManager and application receipts. Root independently checked custody and source provenance, and reproduced the first finding.

## Exact candidate and scope

- HEAD `232fe82e00698776caf73c9b45cdff3f5319f22f`; parent `ccfb504b8c07e62959fb7b705600d46de83f6e36`; tree `7b9d230a651061d2189da9c3258eb839a5a6a6a4`.
- HEAD^^ / accepted M1 base `2d1bcf6df6286d863e6e789de2cf776b76d9fa71`; recovered exact ad37071 ancestry preserved.
- Clean detached review checkout `/home/vercel-sandbox/neutralis-ai/.context/arb003-review-c01`. The full M1-to-HEAD delta was reviewed, including the final evidence-only commit, rather than only its immediate-parent diff. No product source changes.
- All seven accepted groups were assessed against the exact 23,823-byte proposal SHA256 `8ba8625dcfb603f72bc21f6b720988a915d2b894de601c8905a02310e6d7ce2c`. No international-positive-quantity or US-NO-consideration capability was assumed. Root's independent fixture/package/schema custody receipts are `.context/arb002-review-transfer/arb003-c01-verified-custody.json` and `.context/arb003-source-provenance/`.

## 1. A smaller echoed Kalshi initial quantity can redefine an original order as complete

**High severity.** `neutralis/execution/outcomes.py:165` checks the returned initial/fill/remainder arithmetic but never compares `initial_count_fp` with the immutable original `binding.amount`. `full()` at line 563 compares applied quantity with the returned cumulative quantity; it never establishes that the original request completed. Event dispatch at `neutralis/engine/event_loop.py:2055` and polling at `scripts/run_once.py:776` both trust this result before submitting the next leg.

Reproduction: the normal supported Kalshi-only two-leg selection binds/submits first count **2**. The external GetOrder double preserves original request/order/client/ticker/side correlation but returns `initial_count_fp='1'`, `fill_count_fp='1'`, `remaining_count_fp='0'`, `status='executed'` and actual consideration `$0.40`. Both actual runtimes submit the second count-2 order, record actual quantities **[1.0, 2.0]**, and finish with `unresolved=False` and no issues. The event runtime also reports a completed LIVE execution. These are external doubles, not real orders.

Expected: retain raw evidence and any supportable observed one-contract exposure; flag the original-size/completion contradiction and halt additional entries. Do not repair this by deleting real observations, inventing another fill, resubmitting, or universally denying valid complete cases. The original request cannot be redefined by a contradictory response.

Exact repro: `.context/entry-review/test_entry_paths.py::test_smaller_reported_initial_quantity_cannot_unlock_next_leg`, event and polling parameters. Root independently reproduced both failures in `.context/arb003-c01-root-reproduction.log` (SHA256 `693f7305d904c8c03ea3c11bb882be216a13825a3288b2152062c809db1d77f4`).

## 2. Kalshi complement continuation accepts unequal original payoff units

**High severity.** `neutralis/execution/outcomes.py:593` applies the existing dollar cap independently before computing each leg's quantity. Whole-plan validation does not verify the complementary unit/payoff relation. The Kalshi-only loop at `neutralis/engine/event_loop.py:2043` and polling continuation at `scripts/run_once.py:776` check individual completion only. Unlike the US-to-Kalshi path, neither checks that completing the next complementary leg preserves the supplied payoff units.

Reproduction: on the same passing Kalshi complement selection, set the existing `execution.max_order_dollars` to **$0.95**. The real guard/ranker selects **$2.14**; independently capped requested quantities become **[1, 2]**. Unmodified faithful GetOrder responses confirm both requests completely. Both actual runtimes submit and record **one YES and two NO contracts**, then return `unresolved=False` with no issues. This defect does not require malformed or contradictory venue data.

Expected: validate the supplied complementary unit relation before authorizing full continuation. A known unequal plan should fail before outbound work where possible; already-observed exposure must remain retained. This requests the accepted relation check, not a new sizing strategy, automatic hedge, routing rewrite or short-position model.

Exact repro: `.context/entry-review/test_entry_paths.py::test_unequal_original_complement_quantities_do_not_complete_unbalanced_route`, event and polling parameters. Root independently reproduced both failures in `.context/arb003-c01-root-payoff-reproduction.log` (SHA256 `39d102625624b512997f6e6049d1a74571a3f98a4da0cb148b978c3a3ee54c1f`).

## Verification

All commands ran from the exact detached checkout using the inspected `tests/arbitrage/offline_runner.py`, root's task-local CPython 3.13.15 and unchanged installed dependencies. Prefix:

```sh
unshare --user --map-root-user --net env -i PATH=/usr/bin:/bin /home/vercel-sandbox/neutralis-ai/.context/arb002-review-venv/bin/python -B tests/arbitrage/offline_runner.py --installed-dependencies --disable-plugin-autoload -q -p no:cacheprovider
```

Append the following test selections:

| Selection | Result | Evidence relative to review checkout |
|---|---|---|
| `tests/arbitrage tests/test_execution.py tests/test_portfolio_manager.py --tb=short` | exit 0; **400 passed**, 9.53 s | `.context/independent/affected.log` |
| `tests/arbitrage/.context/reviewer/test_review_outcomes.py --tb=short` | **16 passed**, 0.16 s | `.context/independent/outcomes.log` |
| `.context/entry-review/test_entry_paths.py --tb=short -s` | exit 1; **4 failed, 12 passed**, 3.73 s; four failures are the two findings across two runtimes | `.context/entry-review/final-results.log` |
| `tests/test_directional.py --tb=short` | exit 1; **34 passed, 1 failed**, 0.09 s | `.context/independent/directional.log` |

The separate directional failure is the previously recorded `TestEvaluateDirectionalSignal.test_reject_duplicate_position`: expects reject, receives pass. Its test, guard and directional scanner source are unchanged against M1; it remains outside this candidate's scope. No required skips or xfails were used.

The 16 additional main-review probes exercise both fixed authorities under four arrival orders and repeated replay; actual ledger total/receipt arithmetic for `3@$0.40 + 2@$0.50 = 5/$2.20`; changed US execution quantity/cost/currency under the same ID; and three storage failure variants after a trade is acknowledged (position raises, invalid position acknowledgement, and update raises). For the latter, A and B actually start through real adapter/future paths before either returns an observation. B remains externally held past timeout while A's entry becomes application-unknown. B later reaches its original collector as not-attempted; repeated callbacks cause no further writes. Original dependency lifetime and outbound stop are checked. No pending state is bypassed to start B after observing A's partial/unknown result.

The 12 additional dispatch positives retain the first US YES receipt through later Kalshi partial/error/wrong-order/wrong-side responses or control revocation, and retain delayed real-adapter US responses through both runtimes without submitting a next leg. The required unsupported cases, supported controls, account/leg association, both acknowledged cumulative totals, alternate evidence, helper receipt failures, capacity, late cancellation and paper separation also execute in the 400-case affected suite. Historical guessed-fill assertions were replaced with source-supported GetOrder/US evidence or explicit unsupported assertions; none was promoted to real venue truth.

## Limits and routing

Network namespace and pre-import TCP/DNS/key-file/environment/Postgres guards were active. Test preparation, scoring/dispatch, permission gates, adapter payload/response handling and PortfolioManager were real code; external transport/SDK/signing/storage/control boundaries were doubles. International SDK value constructors remain doubles. Installed imports and schema provenance do not prove real SDK serialization/signing/internal retries, exchange compatibility, production storage precision, atomicity, concurrency or restart replay. No real SDK client, account/venue/DB request, daemon/polling loop startup, database application, push or deployment occurred.

Route these two bounded findings to the same sole arbitrage owner for a revised committed candidate. Preserve accepted M1, exact recovered fix, source/evidence custody, current unsupported cases and Railway publication hold. This review grants no live or publication authority.
