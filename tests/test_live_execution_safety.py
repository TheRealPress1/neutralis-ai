"""Live failures must never become simulated trades or invented hedge fills.

All database and exchange boundaries are mocked: these tests place no orders.
"""

from dataclasses import replace
import sys
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from neutralis.config import DatabaseConfig, ExecutionConfig, ExitConfig, PerformanceFeeConfig, Settings
from neutralis.engine import event_loop
from neutralis.execution.polymarket_us import PolymarketUSExecutor
from neutralis.models import TradeSide
from neutralis.portfolio.manager import PortfolioManager, is_confirmed_execution
from scripts import run_once


def settings_for(*, live=True):
    return Settings(
        db=DatabaseConfig(dsn="postgresql://unused"),
        execution=ExecutionConfig(
            live_trading_enabled=live, kalshi_api_key_id="", kalshi_private_key_path="",
            polymarket_private_key="", polymarket_us_key_id="", polymarket_us_secret_key="",
        ),
        exits=ExitConfig(enabled=False),
        performance_fees=PerformanceFeeConfig(enabled=False),
    )


def real_portfolio():
    storage = MagicMock()
    storage.get_open_positions.return_value = []
    portfolio = PortfolioManager(storage)
    portfolio._upsert_position = MagicMock()
    return storage, portfolio


def filled_order(*, side="yes", venue="kalshi", order_id="real-order", ticker="TEST-DEEP", **extra):
    return {
        "order_id": order_id, "ticker": ticker, "side": side, "venue": venue,
        "status": "executed", "fill_count": 3, f"{side}_price": 50, **extra,
    }


@pytest.mark.parametrize("result, confirmed", [
    ({"success": True, "orderID": "pending"}, False),
    ({"order_id": "resting", "status": "resting"}, False),
    ({"order_id": "empty", "status": "executed", "fill_count": 0}, False),
    ({"order_id": "bad", "fill_count_fp": "nan"}, False),
    ({"status": "executed", "fill_count": 3}, False),
    ({"order_id": "partial", "status": "resting", "fill_count_fp": "0.50"}, True),
    ({"orderID": "poly", "status": "matched"}, True),
    ({"orderID": "us", "filled": True}, True),
])
def test_confirmation_requires_exchange_fill_evidence(result, confirmed):
    assert is_confirmed_execution(result) is confirmed


def test_polymarket_us_accepted_order_is_not_a_fill():
    executor = PolymarketUSExecutor.__new__(PolymarketUSExecutor)
    pending = executor._normalize_result({"id": "accepted", "executions": []})
    assert pending["success"] is True
    assert not is_confirmed_execution(pending)
    filled = executor._normalize_result({"id": "filled", "executions": [{"type": "EXECUTION_TYPE_FILL"}]})
    assert is_confirmed_execution(filled)


@pytest.mark.parametrize("results", [None, [], [{"order_id": "accepted", "ticker": "TEST-DEEP", "side": "yes", "success": True}]])
def test_live_accounting_never_invents_fills(sample_signal, sample_decision, results):
    storage, portfolio = real_portfolio()
    assert portfolio.record_fill(sample_signal, sample_decision, 7, is_paper=False, execution_results=results) == []
    storage.save_trade.assert_not_called()
    portfolio._upsert_position.assert_not_called()


def test_partial_same_ticker_pair_records_only_confirmed_side(sample_signal, sample_decision):
    storage, portfolio = real_portfolio()
    trades = portfolio.record_fill(sample_signal, sample_decision, 7, is_paper=False, execution_results=[filled_order()])
    assert len(trades) == 1
    assert trades[0].side == TradeSide.BUY_YES
    assert trades[0].order_id == "real-order"
    assert trades[0].quantity == 3
    assert trades[0].size_dollars == 1.5
    assert trades[0].is_paper is False
    storage.save_trade.assert_called_once()


def test_results_match_venue_ticker_and_side_not_position(sample_signal, sample_decision):
    _, portfolio = real_portfolio()
    signal = replace(sample_signal, legs=(sample_signal.legs[0], replace(sample_signal.legs[1], venue="polymarket_us")))
    results = [filled_order(side="no", venue="polymarket_us", order_id="us"), filled_order(order_id="kalshi")]
    trades = portfolio.record_fill(signal, sample_decision, 7, is_paper=False, execution_results=results)
    assert [(trade.venue, trade.side, trade.order_id) for trade in trades] == [
        ("kalshi", TradeSide.BUY_YES, "kalshi"), ("polymarket_us", TradeSide.BUY_NO, "us"),
    ]


def test_one_order_cannot_fill_duplicate_legs(sample_signal, sample_decision):
    _, portfolio = real_portfolio()
    signal = replace(sample_signal, legs=(sample_signal.legs[0], sample_signal.legs[0]))
    trades = portfolio.record_fill(signal, sample_decision, 7, is_paper=False, execution_results=[filled_order()])
    assert len(trades) == 1


def test_fractional_fill_count_and_zero_price_are_preserved(sample_signal, sample_decision):
    _, portfolio = real_portfolio()
    result = filled_order(fill_count_fp="1.25", yes_price_dollars="0.0000")
    trades = portfolio.record_fill(sample_signal, sample_decision, 7, is_paper=False, execution_results=[result])
    assert len(trades) == 1
    assert trades[0].quantity == 1.25
    assert trades[0].price == 0
    assert trades[0].size_dollars == 0


def test_intentional_paper_accounting_still_records_both_legs(sample_signal, sample_decision):
    _, portfolio = real_portfolio()
    trades = portfolio.record_fill(sample_signal, sample_decision, 7, is_paper=True)
    assert len(trades) == 2
    assert all(trade.is_paper for trade in trades)


@pytest.mark.parametrize("failure", [False, TimeoutError("uncertain exchange result")])
def test_event_engine_live_failure_only_records_error(monkeypatch, sample_signal, sample_decision, deep_book_market, failure):
    engine = event_loop.EventEngine.__new__(event_loop.EventEngine)
    engine._state = SimpleNamespace(orders_placed=0)
    engine._log_pipeline = MagicMock()
    engine._try_live_execute = MagicMock(return_value=False)
    if isinstance(failure, Exception):
        engine._try_live_execute.side_effect = failure
    storage = MagicMock()
    storage.save_decision.return_value = 7
    storage_factory = MagicMock()
    storage_factory.return_value.__enter__.return_value = storage
    monkeypatch.setattr(event_loop, "PostgresStorage", storage_factory)
    portfolio = MagicMock()
    monkeypatch.setattr(event_loop, "PortfolioManager", MagicMock(return_value=portfolio))
    monkeypatch.setattr(event_loop, "compute_market_features", MagicMock())
    monkeypatch.setattr(event_loop, "estimate_costs", MagicMock())
    monkeypatch.setattr(event_loop, "score_signal", lambda *a, **kw: dict(confidence_score=80, time_to_resolution_days=1, roi_per_day=2, net_edge=.02))
    monkeypatch.setattr(event_loop, "evaluate_signal", MagicMock(return_value=sample_decision))
    monkeypatch.setattr(event_loop, "select_portfolio", lambda pairs, *a, **kw: pairs)
    engine._score_and_execute(sample_signal, deep_book_market, settings_for())
    assert engine._state.orders_placed == 0
    storage.save_trade.assert_not_called()
    storage.save_order.assert_not_called()
    storage.save_fill.assert_not_called()
    portfolio.record_fill.assert_not_called()
    assert any(call.args[0] == "error" for call in engine._log_pipeline.call_args_list)


@pytest.mark.parametrize("missing_venue", ["polymarket", "polymarket_us", "unsupported"])
def test_missing_hedge_executor_does_not_execute_kalshi_leg(sample_signal, sample_decision, missing_venue):
    engine = event_loop.EventEngine.__new__(event_loop.EventEngine)
    engine._has_kalshi_db_creds = True
    engine._execute_kalshi_live = MagicMock()
    signal = replace(sample_signal, legs=(sample_signal.legs[0], replace(sample_signal.legs[1], venue=missing_venue)))
    assert not engine._try_live_execute(signal, sample_decision, 7, settings_for(), MagicMock(), MagicMock())
    engine._execute_kalshi_live.assert_not_called()


@pytest.mark.parametrize("second_result", [{"order": {"status": "rejected"}}, TimeoutError("second leg uncertain")])
def test_event_engine_keeps_actual_first_fill_when_second_leg_fails(sample_signal, sample_decision, second_result):
    engine = event_loop.EventEngine.__new__(event_loop.EventEngine)
    executor = MagicMock()
    executor.place_order.side_effect = [{"order": filled_order()}, second_result]
    engine._make_kalshi_executor = MagicMock()
    engine._make_kalshi_executor.return_value.__enter__.return_value = executor
    storage, portfolio = real_portfolio()
    assert not engine._execute_kalshi_live(sample_signal, sample_decision, 7, settings_for(), storage, portfolio, list(sample_signal.legs))
    storage.save_trade.assert_called_once()
    assert storage.save_trade.call_args.args[0].side == TradeSide.BUY_YES


def test_cross_venue_depth_failure_preserves_first_venue_fill(monkeypatch, sample_signal, sample_decision):
    engine = event_loop.EventEngine.__new__(event_loop.EventEngine)
    engine._resolve_poly_token_id = MagicMock(return_value="test-token")
    engine._check_orderbook_depth = MagicMock(return_value=False)
    engine._make_kalshi_executor = MagicMock()
    poly_class = MagicMock()
    poly_class.return_value.__enter__.return_value.place_market_order.return_value = {"orderID": "poly-fill", "status": "matched"}
    monkeypatch.setitem(sys.modules, "neutralis.execution.polymarket", SimpleNamespace(PolymarketExecutor=poly_class))
    signal = replace(sample_signal, legs=(sample_signal.legs[0], replace(sample_signal.legs[1], venue="polymarket")))
    storage, portfolio = real_portfolio()
    assert not engine._execute_xp_taker(signal, sample_decision, 7, settings_for(), storage, portfolio, [signal.legs[0]], [signal.legs[1]])
    engine._make_kalshi_executor.assert_not_called()
    storage.save_trade.assert_called_once()
    trade = storage.save_trade.call_args.args[0]
    assert trade.venue == "polymarket"
    assert trade.side == TradeSide.BUY_NO
    assert trade.order_id == "poly-fill"


def test_maker_later_rejection_preserves_earlier_fill(monkeypatch, sample_signal, sample_decision):
    engine = event_loop.EventEngine.__new__(event_loop.EventEngine)
    engine._check_orderbook_depth = MagicMock(return_value=True)
    engine._compute_maker_price = MagicMock(return_value=50)
    executor = MagicMock()
    executor.place_order.side_effect = [{"order": filled_order()}, {"order": {"status": "rejected"}}]
    engine._make_kalshi_executor = MagicMock()
    engine._make_kalshi_executor.return_value.__enter__.return_value = executor
    poly_class = MagicMock()
    monkeypatch.setitem(sys.modules, "neutralis.execution.polymarket", SimpleNamespace(PolymarketExecutor=poly_class))
    storage, portfolio = real_portfolio()
    assert not engine._execute_xp_maker(sample_signal, sample_decision, 7, settings_for(), storage, portfolio, list(sample_signal.legs), [])
    poly_class.assert_not_called()
    storage.save_trade.assert_called_once()
    assert storage.save_trade.call_args.args[0].side == TradeSide.BUY_YES


def test_partial_accounting_failure_is_not_retried(sample_signal, sample_decision):
    engine = event_loop.EventEngine.__new__(event_loop.EventEngine)
    portfolio = MagicMock()
    portfolio.record_fill.side_effect = RuntimeError("database disconnected after a partial write")
    assert not engine._record_partial_live_results(sample_signal, sample_decision, 7, portfolio, [filled_order()])
    portfolio.record_fill.assert_called_once()


def polling_harness(monkeypatch, sample_signal, sample_decision, *, directional=False, live=True, executor=None):
    settings = settings_for(live=live)
    storage = MagicMock()
    storage.get_automation_state.return_value = {"status": "running"}
    storage.save_decision.return_value = 7
    storage_factory = MagicMock()
    storage_factory.return_value.__enter__.return_value = storage
    monkeypatch.setattr(run_once, "PostgresStorage", storage_factory)
    portfolio = MagicMock()
    portfolio.get_snapshot.return_value = SimpleNamespace(open_position_count=0, total_exposure_dollars=0)
    portfolio.get_snapshot_filtered.return_value = portfolio.get_snapshot.return_value
    portfolio.mark_to_market.return_value = 0
    monkeypatch.setattr(run_once, "PortfolioManager", MagicMock(return_value=portfolio))
    monkeypatch.setattr(run_once, "run_settlement", MagicMock(return_value=SimpleNamespace(settled=0, pnl=0)))
    monkeypatch.setattr(run_once, "check_daily_loss_limit", MagicMock(return_value=SimpleNamespace(passed=True)))
    monkeypatch.setattr(run_once, "load_active_profile", MagicMock(return_value=None))
    monkeypatch.setattr(run_once, "_score_signal", lambda signal, *a, **kw: signal)
    monkeypatch.setattr(run_once, "evaluate_signal", MagicMock(return_value=sample_decision))
    monkeypatch.setattr(run_once, "evaluate_directional_signal", MagicMock(return_value=sample_decision))
    monkeypatch.setattr(run_once, "select_portfolio", lambda pairs, *a, **kw: pairs)
    # Stub the optional international SDK import and all exchange constructors.
    monkeypatch.setitem(sys.modules, "neutralis.execution.polymarket", SimpleNamespace(PolymarketExecutor=MagicMock()))
    from neutralis.execution import kalshi
    kalshi_class = MagicMock()
    kalshi_class.from_credentials.return_value = executor
    monkeypatch.setattr(kalshi, "KalshiExecutor", kalshi_class)
    credentials = SimpleNamespace(kalshi=SimpleNamespace(api_key_id="test", private_key_pem="test") if executor else None)
    monkeypatch.setattr(run_once, "load_user_credentials", MagicMock(return_value=credentials))
    from neutralis.guard import bankroll
    monkeypatch.setattr(bankroll, "fetch_bankroll_from_executors", MagicMock(return_value=0))
    paper = MagicMock()
    paper.return_value.execute.return_value = SimpleNamespace(orders=[object()], fills=[object()], trades=[])
    monkeypatch.setattr(run_once, "PaperExecutor", paper)
    scan = SimpleNamespace(
        match_ids={"already-stored": 1}, complement_signals=[] if directional else [sample_signal],
        three_way_signals=[], xp_signals=[], directional_signals=[sample_signal] if directional else [],
        enriched_markets={}, kalshi_by_ticker={}, poly_markets=[], poly_us_markets=[],
        pipeline_cfg=settings.pipeline, regime_params={}, min_confidence=0,
    )
    return settings, scan, storage, portfolio, paper


@pytest.mark.parametrize("directional", [False, True])
def test_polling_live_missing_executor_never_simulates(monkeypatch, sample_signal, sample_decision, tick_context, directional):
    settings, scan, storage, portfolio, paper = polling_harness(monkeypatch, sample_signal, sample_decision, directional=directional)
    notifier = MagicMock()
    result = run_once.evaluate_and_execute_for_user({"user_id": "test-user"}, scan, settings, notifier, tick_context)
    paper.assert_not_called()
    portfolio.record_fill.assert_not_called()
    storage.save_trade.assert_not_called()
    notifier.notify_fill.assert_not_called()
    assert result.orders_created == result.fills_created == 0
    assert storage.save_pipeline_log.call_args.args[0] == "error"
    storage.flush_pipeline_logs.assert_called()


@pytest.mark.parametrize("directional", [False, True])
def test_polling_explicit_paper_mode_still_executes(monkeypatch, sample_signal, sample_decision, tick_context, directional):
    settings, scan, storage, _, paper = polling_harness(monkeypatch, sample_signal, sample_decision, directional=directional, live=False)
    result = run_once.evaluate_and_execute_for_user({"user_id": "test-user"}, scan, settings, MagicMock(), tick_context)
    paper.assert_called_once()
    paper.return_value.execute.assert_called_once()
    assert result.orders_created == result.fills_created == 1
    storage.save_pipeline_log.assert_not_called()


@pytest.mark.parametrize("failure", [{"order": {"status": "rejected"}}, TimeoutError("uncertain exchange result")])
@pytest.mark.parametrize("directional", [False, True])
def test_polling_rejection_or_timeout_never_simulates(monkeypatch, sample_signal, sample_decision, tick_context, failure, directional):
    executor = MagicMock()
    executor.get_balance.return_value = 1000
    if isinstance(failure, Exception):
        executor.place_order.side_effect = failure
    else:
        executor.place_order.return_value = failure
    signal = replace(sample_signal, entry_side="yes")
    settings, scan, storage, portfolio, paper = polling_harness(monkeypatch, signal, sample_decision, executor=executor, directional=directional)
    notifier = MagicMock()
    result = run_once.evaluate_and_execute_for_user({"user_id": "test-user"}, scan, settings, notifier, tick_context)
    executor.place_order.assert_called_once()
    paper.assert_not_called()
    portfolio.record_fill.assert_not_called()
    notifier.notify_fill.assert_not_called()
    assert result.orders_created == result.fills_created == 0
    assert storage.save_pipeline_log.call_args.args[0] == "error"
