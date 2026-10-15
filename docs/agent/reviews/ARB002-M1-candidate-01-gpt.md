# ARB002 M1 independent review — c01

**Verdict: REQUEST CHANGES.** Same-family independent GPT review under the recorded Claude quota exception; this is not a new Fable/cross-family pass. Three material M1 contract gaps below. No publication, live-readiness, fill-truth or procurement approval is implied.

Reviewed 2026-09-07 in clean detached `/home/vercel-sandbox/neutralis-ai/.context/arb002-review-c01`:

- HEAD `8f0d9359a871870f2f8a51d9718c5c90cf7c0b5b`.
- Parent `ad37071ae6bbc4a31289f9e662388c50e92ac3d3`; tree `fada46292c6817a047d4cc457f0c0031db0c0ce0`.
- Independently checked these IDs and clean status before/after tests. `git diff --check HEAD^ HEAD` passed. Committed accepted proposal is byte-identical to root's a62c0f46 export (`cmp`, exit 0). Recovery patch was not reapplied.
- Read root PROJECT/STATE/MEMORY-INDEX, FIX-RECOVERY, current ARB002 ticket, candidate AGENTS, accepted contract and pinned cross-family-review skill. Inspected runner, root/arbitrage conftest, selected test imports and storage import before execution.

## Findings

1. **P1 — Missing selected-route dependencies permit one-legged event dispatch.** At [event_loop.py:2021](../../../.context/arb002-review-c01/neutralis/engine/event_loop.py#L2021), cross-venue selection checks only the Polymarket factory; [2035](../../../.context/arb002-review-c01/neutralis/engine/event_loop.py#L2035) then accepts any Kalshi legs as a Kalshi-only signal. With a valid prepared run containing only Kalshi dependencies/availability, a passing Kalshi+international signal sends one Kalshi POST and records one trade. With only international dependencies/availability, it posts the international leg before discovering missing Kalshi dependencies in the next step ([2314](../../../.context/arb002-review-c01/neutralis/engine/event_loop.py#L2314), [2374](../../../.context/arb002-review-c01/neutralis/engine/event_loop.py#L2374)). Same polling inputs send zero orders. Expected: selected route must have all required venue dependencies/availability before the first submission; no order or paper fallback on this startup denial. This is a failure to implement M1's new selected-route contract (proposal 89, 122, 135–141), not an assertion that all underlying branch structure is newly introduced. Preflight the complete selected route; no accounting redesign is needed.

2. **P1 — Control revocation loses a partial fill reported in the initial maker response.** [event_loop.py:2483](../../../.context/arb002-review-c01/neutralis/engine/event_loop.py#L2483) reads the initial order, but only an `executed` status enters `kalshi_results`. The partial tracker is reset at [2503](../../../.context/arb002-review-c01/neutralis/engine/event_loop.py#L2503); the new denial continuation at [2543](../../../.context/arb002-review-c01/neutralis/engine/event_loop.py#L2543) retains only evidence learned from a later poll. A synthetic initial POST response with `status='resting'`, `fill_count=1`, `order_id='k-partial'`, and `yes_price=44`, followed by provider pause before return, produces one POST, correctly denies the GET/cancel/second leg, but records zero trades. Control experiment: the same partial evidence returned from the first GET and then pause records the original order once, quantity 1.0. With no pause it follows existing partial handling. Expected: retain initial response evidence for the original recording continuation when the next action is denied. This isolates a newly introduced `ExecutionDenied` outcome-loss path (proposal 95–105, 210–217), not a demand to repair all historical early returns or certify normalized fills. Preserve evidence without manufacturing a fill.

3. **P2 — The new missing-input denial is swallowed by the old fail-open catch.** [event_loop.py:2231](../../../.context/arb002-review-c01/neutralis/engine/event_loop.py#L2231) raises `ExecutionDenied('INPUT_UNAVAILABLE')` when the explicitly supplied market cache lacks the required Kalshi book; [2270](../../../.context/arb002-review-c01/neutralis/engine/event_loop.py#L2270) catches it and returns `True`. A prepared run containing only the paired Polymarket market returns depth=True for the absent Kalshi ticker and sends both maker-route orders. Expected: that named missing-input denial must stop the dispatch before the first order (proposal 118, 130–132). The fail-open arithmetic predates M1; introducing a named denial underneath that catch is the M1 integration defect. Preserve historical depth arithmetic while allowing missing required input to deny.

## Independent verification

Working directory for commands below is the detached candidate. All product checks used CPython 3.13.15 from `.context/arb002-review-venv`, fresh environment, user/network namespace, `-B`, the inspected runner's TCP/DNS/key-file/real-Postgres barriers, actual installed imports and explicit external doubles. No daemon/main/polling loop, real SDK client, credential signer, DB, venue account or notification transport was started. Pytest plugin autoload was disabled by CLI because the runner clears environment variables.

```sh
git rev-parse HEAD HEAD^ HEAD^{tree}
git status --short
git diff --check HEAD^ HEAD
cmp docs/arbitrage/ARB002-accepted-proposal.md /home/vercel-sandbox/neutralis-ai/.context/ARB002-proposed-ticket-export-a62c0f46.md
unshare --user --map-root-user --net env -i PATH=/usr/bin:/bin /home/vercel-sandbox/neutralis-ai/.context/arb002-review-venv/bin/python -B tests/arbitrage/offline_runner.py --installed-dependencies --disable-plugin-autoload -q -p no:cacheprovider tests/arbitrage tests/test_execution.py tests/test_portfolio_manager.py --tb=short
unshare --user --map-root-user --net env -i PATH=/usr/bin:/bin /home/vercel-sandbox/neutralis-ai/.context/arb002-review-venv/bin/python -B tests/arbitrage/offline_runner.py --installed-dependencies --disable-plugin-autoload -q -p no:cacheprovider tests/test_directional.py --tb=short
```

Selected suite: **190 passed, 3.76s, exit 0**, no skips/xfails. Directional: **34 passed / 1 failed, 0.09s, exit 1**; `TestEvaluateDirectionalSignal.test_reject_duplicate_position` at line 326 expected reject, got pass. Test, directional scanner and guard decision files are unchanged against the exact parent (`git diff HEAD^ HEAD -- tests/test_directional.py neutralis/guard/decision.py neutralis/core/directional_scanner.py`, empty). The prior baseline failure is recorded in builder/project evidence; I reproduced the candidate failure, not a new baseline run.

Installed environment: pytest 9.1.1, psycopg 3.3.5, httpx 0.28.1, websockets 16.1.1, cryptography 46.0.7, py-clob-client 0.34.6, polymarket-us 0.1.2. Full resolution/provenance: `arb002-review-env/evidence/resolved-requirements.txt` and environment manifest. Requirements were unchanged. In an additional guarded probe I replaced only the harness's international value-constructor doubles with installed `py_clob_client.clob_types`; real adapter market/limit methods produced real `MarketOrderArgs(amount=2.5, side='BUY')`, `OrderArgs(price=.45, size=2)`, `PartialCreateOrderOptions`, and FOK/GTC posts successfully into the external SDK double. Installed imports and value construction are therefore exercised; real SDK serialization, signing, internal retry behavior, HTTP exchange contracts and deployed dependency compatibility remain unverified.

## Preserved minimal adversarial reproducer

The source below lives only in this review artifact, outside the detached candidate. It uses the same inspected guards and fixture data, retains real preparation/producer/scoring/dispatch/adapter/PortfolioManager paths, and supplies only external doubles. The assertions express the accepted behavior and fail on this candidate. The already reproduced positive polling cases are included to distinguish route denial from universal rejection. No product response handler is mocked.

Run from the detached candidate:

```sh
unshare --user --map-root-user --net env -i PATH=/usr/bin:/bin /home/vercel-sandbox/neutralis-ai/.context/arb002-review-venv/bin/python -B - <<'PY'
from pathlib import Path
artifact = Path('/home/vercel-sandbox/neutralis-ai/.context/arb002-review-c01-independent.md').read_text()
source = artifact.split('<!-- BEGIN ' + 'REVIEW REPRO -->', 1)[1].split('<!-- END ' + 'REVIEW REPRO -->', 1)[0]
source = source.split('```python\n', 1)[1].rsplit('```', 1)[0]
exec(compile(source, 'arb002-review-c01-independent.md:repro', 'exec'))
PY
```

<!-- BEGIN REVIEW REPRO -->
```python
from pathlib import Path
import sys
runner = Path('tests/arbitrage/offline_runner.py').resolve()
__file__ = str(runner)
sys.argv = [str(runner), '--installed-dependencies']
exec(runner.read_text().split('import pytest\n')[0])
from neutralis.storage.postgres import PostgresStorage
PostgresStorage.connect = denied
PostgresStorage._ensure_connected = denied
import importlib.util, logging, unittest
logging.disable(logging.CRITICAL)
spec = importlib.util.spec_from_file_location('review_root_fixtures', 'tests/conftest.py')
rootf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rootf)
sys.path.insert(0, str(Path('tests/arbitrage').resolve()))
import conftest as af
from test_dispatch import event_engine, scan_for
from test_routes import xp_inputs, mutations
from dataclasses import replace
from unittest.mock import Mock
from neutralis.models import TradeLeg
from neutralis.execution.mode import prepare_execution_run
from scripts.run_once import evaluate_and_execute_for_user

class ContractRepros(unittest.TestCase):
    def setUp(self):
        self.market = af.deep_book_market.__wrapped__(rootf.deep_book_market.__wrapped__())
        self.make = af.harness.__wrapped__(self.market)

    def dispatch(self, h, k, p):
        e = event_engine(h)
        try:
            e._execute_xp_arb(k.ticker, k, p, .98, .10, 10, 'kalshi', 'polymarket')
        finally:
            e._executor_pool.shutdown()
            e._log_executor.shutdown()

    def test_all_selected_route_dependencies_required(self):
        for runtime in ('event', 'polling'):
            for available in ('kalshi', 'polymarket'):
                with self.subTest(runtime=runtime, available=available):
                    k, p = xp_inputs(self.market, 'polymarket')
                    h = self.make('live', [k, p]); old = h.run
                    h.run = prepare_execution_run(policy=old.policy, run_id=old.run_id,
                        user_id=old.user_id, controls_provider=old.controls_provider,
                        market_inputs=old.market_inputs, reference_portfolio=old.reference_portfolio,
                        decision_sink=old.decision_sink,
                        adapter_factories={available: old.adapter_factories[available]},
                        live_storage_factory=old.live_storage_factory,
                        route_availability={available: True})
                    h.settings = replace(h.settings,
                        execution=replace(h.settings.execution, use_maker_orders=False))
                    if runtime == 'event':
                        self.dispatch(h, k, p)
                    else:
                        sample = rootf.sample_signal.__wrapped__(self.market)
                        signal = replace(sample, ticker=k.ticker, market_snapshot=k,
                            edge_pct=10, combined_cost=.80,
                            legs=(TradeLeg(k.ticker,'yes',.45,10,'kalshi'),
                                  TradeLeg(p.ticker,'no',.35,10,'polymarket')))
                        scan = scan_for(signal, k, h.settings); scan.poly_markets = [p]
                        evaluate_and_execute_for_user({'user_id':'test-user'}, scan,
                            h.settings, Mock(), rootf.tick_context.__wrapped__(), run=h.run)
                    self.assertEqual([(x[0],x[1]) for x in mutations(h)], [])
                    self.assertEqual(h.storage.save_trade.call_count, 0)

    def test_initial_partial_survives_control_stop(self):
        k, p = xp_inputs(self.market, 'polymarket'); h = self.make('live', [k, p])
        h.settings = replace(h.settings,
            execution=replace(h.settings.execution, use_maker_orders=True))
        request = h.http.request
        def initial_partial(method, path, **kw):
            response = request(method, path, **kw)
            if method == 'POST':
                data = response.json()
                data['order'].update(status='resting', fill_count=1,
                                     order_id='k-partial', yes_price=44)
                response.json = lambda: data
                h.controls['status'] = 'paused'
            return response
        h.http.request = initial_partial
        self.dispatch(h, k, p)
        self.assertEqual([(x[0],x[1]) for x in mutations(h)], [('kalshi','POST')])
        self.assertEqual([(c.args[0].order_id,c.args[0].quantity)
                          for c in h.storage.save_trade.call_args_list], [('k-partial',1.0)])
        self.assertFalse(h.simulation.orders)

    def test_missing_required_market_denies_dispatch(self):
        k, p = xp_inputs(self.market, 'polymarket'); h = self.make('live', [p])
        h.settings = replace(h.settings,
            execution=replace(h.settings.execution, use_maker_orders=True))
        self.assertNotIn(k.ticker, h.run.market_inputs)
        self.dispatch(h, k, p)
        self.assertEqual([(x[0],x[1]) for x in mutations(h)], [])

unittest.main(argv=['review-repro'], verbosity=2)
```
<!-- END REVIEW REPRO -->

Initial probes observed: event route-only Kalshi -> one Kalshi POST / one recorded trade; event route-only international -> one international post / one recorded trade; corresponding polling -> zero/zero. Maker initial partial then pause -> one POST / no recorded trade; same partial learned on GET then pause -> one POST + GET / original order quantity 1.0 recorded. Missing Kalshi cache entry -> depth=True / both venue orders / two recorded trades. These are synthetic contract reproductions, not verified venue response examples.

Review scope stops here. Existing acceptance-vs-fill, general partial-outcome accounting, fee correctness, durable paper/database mode uniqueness, exchange exits and replay remain separate later work. Full repository suite, services, live venues, deployments, schema changes and production dependency certification were not run. Only this review artifact was written by the reviewer.
