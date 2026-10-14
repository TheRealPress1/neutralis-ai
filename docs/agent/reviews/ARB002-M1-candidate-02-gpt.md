# ARB002 M1 candidate02 independent affected-path recheck

**Verdict: PASS for the bounded M1 revision.** All three candidate01 findings are resolved at the reviewed head. No new material finding in the affected paths. This is the stable reviewer's same-family GPT recheck under the recorded Claude quota exception, not a new Fable/cross-family approval. It does not authorize publication, live trading, database changes or the next accounting implementation.

Reviewed 2026-09-07 in clean detached `/home/vercel-sandbox/neutralis-ai/.context/arb002-review-c02`:

- HEAD `2d1bcf6df6286d863e6e789de2cf776b76d9fa71`.
- Parent `8f0d9359a871870f2f8a51d9718c5c90cf7c0b5b`; tree `278313f6bb455ce5a8feec303aae4e445eb3b57c`.
- Independently verified exact IDs, clean status before/after execution and original `ad37071ae6bbc4a31289f9e662388c50e92ac3d3` ancestry. `git diff --check HEAD^ HEAD` passed; accepted proposal remains byte-identical to root's a62c0f46 export.
- Re-read current PROJECT/STATE/MEMORY-INDEX, ARB002 ticket/FIX-RECOVERY, candidate AGENTS and c02 evidence. Applied the already-read pinned cross-family-review procedure. Inspected the complete added `test_review_regressions.py` before execution. Runner/conftest/import surfaces inspected for c01 are unchanged.

## Resolution and fail-before/pass-after evidence

The **unchanged original independent reproducer** in [candidate01 review](ARB002-M1-candidate-01-gpt.md) was rerun against c02. It failed four assertions across three test methods on c01; on c02 it reports **3 tests OK, 0.259s, exit 0**. The source was not adapted to make the revision pass.

| Finding | Independently observed c01 | Independently observed c02 and source resolution |
|---|---|---|
| Complete selected-route dependencies | Event with only Kalshi or only international dependencies/evidence sent and recorded the available leg; corresponding polling cases sent zero | Both event cases now send/record zero. [mode.py:285](/home/vercel-sandbox/neutralis-ai/.context/arb002-review-c02/neutralis/execution/mode.py:285) checks every selected leg's factory, route evidence and supplied input without invoking factories; [event_loop.py:2014](/home/vercel-sandbox/neutralis-ai/.context/arb002-review-c02/neutralis/engine/event_loop.py:2014) and [run_once.py:818](/home/vercel-sandbox/neutralis-ai/.context/arb002-review-c02/scripts/run_once.py:818) call it before submission. Branch selection no longer degrades mixed/unsupported routes into a subset. |
| Initial maker partial response after control stop | One permitted POST returned legacy synthetic partial evidence, then provider pause; next action denied but original trade missing | One POST only; original `k-partial` recorded once, quantity 1.0, with no paper order. [event_loop.py:2508](/home/vercel-sandbox/neutralis-ai/.context/arb002-review-c02/neutralis/engine/event_loop.py:2508) initializes the existing partial tracker from the initial response; the existing denial continuation retains it. This does not manufacture a fill from acceptance alone. |
| Missing required market input | Absent Kalshi cache entry returned depth=True and allowed both maker submissions | Same missing-input fixture sends zero orders. [event_loop.py:2271](/home/vercel-sandbox/neutralis-ai/.context/arb002-review-c02/neutralis/engine/event_loop.py:2271) now rethrows the named denial; complete-route input preflight precedes the first submission for both paired venues. Legacy depth arithmetic is unchanged. |

Only three product files changed from c01: execution mode policy, event loop and polling dispatcher. Other changes are the 71 revision tests and task/ownership evidence. Adapters, result normalization, config/requirements, portfolio/storage/settlement, fees, scanners and schemas are unchanged. The polling maintenance change and unsupported three-venue branch exclusion implement the same complete-route requirement.

## Current-head test evidence

**261 affected tests passed, 6.02s, exit 0; no skips/xfails.** This run includes all **71 added revision cases**, not an additional separate 71-test run. They exercise international maker/taker and US paired routes in both event/polling dispatch; missing factories with and without complete route evidence; missing either selected market/token/slug; all-available positive routes; initial POST versus later GET partial evidence followed by pause, lookup failure or run stop; zero/absent fill counts; named depth denial; maintained depth sums/tolerance; maintenance and unsupported route denial.

The same affected suite retains the original held-response orderly-stop proof, later-outbound denial, original storage continuation, no-live-to-paper fallback, readonly/shadow/paper controls, and existing valid complement/three-way/directional dispatch cases.

An additional independent **five-case positive control** passed with only the selected venue's factory and route evidence: event Kalshi complement, polling Kalshi complement, and polling directional Kalshi/international/US. Complement cases each produce exactly two Kalshi adapter submissions and two original records. Directional cases each produce exactly one submission to the selected adapter; no unrelated venue dependency or paper fallback is required. Existing missing international/US directional recording tags remain visible and deferred; these checks do not relabel those submissions as confirmed fills.

Interpreter is independently prepared CPython **3.13.15**, pytest **9.1.1**, with actual installed baseline dependencies and unchanged requirements. Full versions/provenance: [resolved requirements](../../../.context/arb002-review-env/evidence/resolved-requirements.txt) and environment manifest. `--installed-dependencies` disables optional import shims; explicit external HTTP/SDK/signer/storage doubles remain. The c01 installed CLOB value-constructor probe belongs to c01 evidence; unchanged adapters do not turn that into a new c02 real-SDK test.

All execution used a fresh environment, OS user/network namespace, the inspected runner's TCP/DNS/key-file/real-Postgres barriers, disabled bytecode and pytest plugin autoload/cache. No real SDK client, key signer, account, database, notification transport, daemon/main/polling loop or service was started.

The historical directional duplicate-position failure remains outside the M1 pass count. I reproduced **34 pass/1 fail on c01**; c02 leaves its test/guard/scanner unchanged and the builder reports the same current-head result. I did not repeat that unrelated suite on c02. No full-repository or production compatibility claim follows.

## Exact commands

Working directory for all commands: `/home/vercel-sandbox/neutralis-ai/.context/arb002-review-c02`.

```sh
git rev-parse HEAD HEAD^ HEAD^{tree}
git status --short
git merge-base --is-ancestor ad37071ae6bbc4a31289f9e662388c50e92ac3d3 HEAD
git diff --check HEAD^ HEAD
git diff --name-only HEAD^ HEAD
cmp docs/arbitrage/ARB002-accepted-proposal.md /home/vercel-sandbox/neutralis-ai/.context/ARB002-proposed-ticket-export-a62c0f46.md
unshare --user --map-root-user --net env -i PATH=/usr/bin:/bin /home/vercel-sandbox/neutralis-ai/.context/arb002-review-venv/bin/python -B tests/arbitrage/offline_runner.py --installed-dependencies --disable-plugin-autoload -q -p no:cacheprovider tests/arbitrage tests/test_execution.py tests/test_portfolio_manager.py --tb=short
```

Original independent reproducer, unchanged:

```sh
unshare --user --map-root-user --net env -i PATH=/usr/bin:/bin /home/vercel-sandbox/neutralis-ai/.context/arb002-review-venv/bin/python -B - <<'PY'
from pathlib import Path
artifact = Path('/home/vercel-sandbox/neutralis-ai/.context/arb002-review-c01-independent.md').read_text()
source = artifact.split('<!-- BEGIN ' + 'REVIEW REPRO -->', 1)[1].split('<!-- END ' + 'REVIEW REPRO -->', 1)[0]
source = source.split('```python\n', 1)[1].rsplit('```', 1)[0]
exec(compile(source, 'arb002-review-c01-independent.md:repro', 'exec'))
PY
```

Additional independent selected-venue-only positive controls (exit 0; five PASS lines):

```sh
unshare --user --map-root-user --net env -i PATH=/usr/bin:/bin /home/vercel-sandbox/neutralis-ai/.context/arb002-review-venv/bin/python -B - <<'PY'
from pathlib import Path
artifact = Path('/home/vercel-sandbox/neutralis-ai/.context/arb002-review-c01-independent.md').read_text()
source = artifact.split('<!-- BEGIN ' + 'REVIEW REPRO -->', 1)[1].split('<!-- END ' + 'REVIEW REPRO -->', 1)[0]
source = source.split('```python\n', 1)[1].rsplit('```', 1)[0]
exec(compile(source.split('class ContractRepros', 1)[0], 'c01-repro-guards', 'exec'))
from datetime import datetime, timedelta, timezone
from neutralis.core.directional_scanner import scan_high_probability
m = af.deep_book_market.__wrapped__(rootf.deep_book_market.__wrapped__())
make = af.harness.__wrapped__(m)
def selected_only(h, venue):
    old = h.run
    h.run = prepare_execution_run(policy=old.policy, run_id=old.run_id, user_id=old.user_id,
        controls_provider=old.controls_provider, market_inputs=old.market_inputs,
        reference_portfolio=old.reference_portfolio, decision_sink=old.decision_sink,
        adapter_factories={venue:old.adapter_factories[venue]},
        live_storage_factory=old.live_storage_factory, route_availability={venue:True})
for runtime in ('event', 'polling'):
    h = make('live', [m]); selected_only(h, 'kalshi')
    sample = rootf.sample_signal.__wrapped__(m)
    if runtime == 'event':
        e = event_engine(h)
        try: e._score_and_execute(sample, m, h.settings)
        finally: e._executor_pool.shutdown(); e._log_executor.shutdown()
    else:
        evaluate_and_execute_for_user({'user_id':'test-user'}, scan_for(sample,m,h.settings),
            h.settings,Mock(),rootf.tick_context.__wrapped__(),run=h.run)
    assert [(x[0],x[1]) for x in mutations(h)] == [('kalshi','POST'),('kalshi','POST')]
    assert h.storage.save_trade.call_count == 2
    assert not h.simulation.orders
    print('SINGLE_KALSHI',runtime,'PASS: two real adapter submissions, original records, no paper')
for venue in ('kalshi','polymarket','polymarket_us'):
    market = replace(m,ticker='KXATPMATCH-TEST',title='Djokovic vs Sinner - ATP',venue=venue,
        yes_ask=.88,yes_bid=.86,no_ask=.14,no_bid=.12,
        expected_expiration=datetime.now(timezone.utc)+timedelta(hours=24),
        clob_token_ids=('token-yes','token-no'),market_slug='synthetic-market')
    h = make('live',[market]); selected_only(h,venue)
    signals = scan_high_probability([market],h.settings.directional); assert signals
    scan = scan_for(signals[0],market,h.settings)
    scan.complement_signals=[]; scan.directional_signals=signals
    evaluate_and_execute_for_user({'user_id':'test-user'},scan,h.settings,Mock(),rootf.tick_context.__wrapped__(),run=h.run)
    assert len(mutations(h)) == 1 and mutations(h)[0][0] == venue
    assert h.storage.save_trade.call_count == (1 if venue == 'kalshi' else 0)
    assert not h.simulation.orders
    print('SINGLE_DIRECTIONAL',venue,'PASS: one real adapter submission, no other venue dependency, no paper')
PY
```

## Remaining limits

This closes the three M1 revision findings, with no required affected-path check left pending. Acceptance-vs-filled semantics, general partial-outcome/timeout recovery, one-to-one fill identity, fees/P&L, durable paper/database uniqueness and exchange-confirmed exits remain later work. Synthetic legacy response dictionaries do not establish current venue schemas. Live eligibility, signing/SDK serialization/internal retries, deployed dependencies/processes/accounts and production persistence remain unverified. Candidate stays frozen and clean; only this independent review artifact was written by the reviewer.
