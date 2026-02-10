#!/usr/bin/env python3
"""CLI runner for the backtesting engine.

Usage:
    python scripts/run_backtest.py --start 2026-01-01 --end 2026-02-10
    python scripts/run_backtest.py --start 2026-01-01 --end 2026-02-10 --min-edge 2.0 --max-position 50
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from neutralis.backtest.engine import run_backtest
from neutralis.logging import get_logger

logger = get_logger("backtest")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a Neutralis backtest")
    parser.add_argument("--start", required=True, help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end", required=True, help="End date (YYYY-MM-DD)")

    # Pipeline overrides
    parser.add_argument("--min-edge", type=float, help="Minimum edge %% to accept")
    parser.add_argument("--min-liquidity", type=float, help="Minimum liquidity $")
    parser.add_argument("--max-position", type=float, help="Max position size $")
    parser.add_argument("--fee-rate", type=float, help="Fee rate override")

    # Portfolio overrides
    parser.add_argument("--max-exposure", type=float, help="Max total exposure $")
    parser.add_argument("--max-positions", type=int, help="Max open positions")

    # Matching overrides
    parser.add_argument("--min-similarity", type=float, help="Min match similarity")

    # Output
    parser.add_argument("--json", action="store_true", help="Output raw JSON")
    parser.add_argument("--output", type=str, help="Save JSON results to file")

    args = parser.parse_args()

    pipeline_overrides = {}
    if args.min_edge is not None:
        pipeline_overrides["min_edge_pct"] = args.min_edge
    if args.min_liquidity is not None:
        pipeline_overrides["min_liquidity_dollars"] = args.min_liquidity
    if args.max_position is not None:
        pipeline_overrides["max_position_dollars"] = args.max_position
    if args.fee_rate is not None:
        pipeline_overrides["fee_rate"] = args.fee_rate

    portfolio_overrides = {}
    if args.max_exposure is not None:
        portfolio_overrides["max_total_exposure_dollars"] = args.max_exposure
    if args.max_positions is not None:
        portfolio_overrides["max_open_positions"] = args.max_positions

    matching_overrides = {}
    if args.min_similarity is not None:
        matching_overrides["min_similarity"] = args.min_similarity

    result = run_backtest(
        start_date=args.start,
        end_date=args.end,
        pipeline_overrides=pipeline_overrides or None,
        portfolio_overrides=portfolio_overrides or None,
        matching_overrides=matching_overrides or None,
    )

    if args.json or args.output:
        data = result.to_dict()
        json_str = json.dumps(data, indent=2, default=str)
        if args.output:
            Path(args.output).write_text(json_str)
            print(f"Results saved to {args.output}")
        else:
            print(json_str)
    else:
        _print_summary(result)

    if args.output:
        _print_summary(result)


def _print_summary(result) -> None:
    """Print a human-readable summary."""
    print("\n" + "=" * 60)
    print("  BACKTEST RESULTS")
    print("=" * 60)
    print(f"  Period:        {result.start_date} to {result.end_date}")
    print(f"  Time steps:    {result.time_steps}")
    print(f"  Duration:      {result.duration_ms:.0f}ms")
    print()
    print(f"  Total P&L:     ${result.total_pnl:+.4f}")
    print(f"  Max Drawdown:  ${result.max_drawdown:.4f}")
    print(f"  Win Rate:      {result.win_rate * 100:.1f}%")
    print()
    print(f"  Signals:       {result.total_signals}")
    print(f"  Passed Guard:  {result.total_passed}")
    print(f"  Rejected:      {result.total_rejected}")
    print(f"  Trades:        {result.total_trades}")
    print()
    print(f"  Positions:     {result.positions_opened} opened, {result.positions_closed} closed")
    print(f"  Wins/Losses:   {result.win_count} / {result.loss_count}")
    print(f"  Best Trade:    ${result.best_trade:+.4f}")
    print(f"  Worst Trade:   ${result.worst_trade:+.4f}")
    print(f"  Avg Trade P&L: ${result.avg_trade_pnl:+.4f}")

    if result.by_category:
        print("\n  Category Breakdown:")
        for cat, data in sorted(result.by_category.items(), key=lambda x: -x[1]["pnl"]):
            print(f"    {cat:16s}  {data['trades']:3d} trades  ${data['pnl']:+.4f}  "
                  f"({data['wins']}W/{data['losses']}L)")

    if result.by_venue:
        print("\n  Venue Breakdown:")
        for v, data in result.by_venue.items():
            print(f"    {v:16s}  {data['trades']:3d} trades  ${data['pnl']:+.4f}")

    if result.by_signal_type:
        print("\n  Signal Type Breakdown:")
        for st, data in result.by_signal_type.items():
            avg_edge = data["total_edge_pct"] / max(data["trades"], 1)
            print(f"    {st:35s}  {data['trades']:3d} trades  avg_edge={avg_edge:.2f}%")

    print("=" * 60)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("Interrupted")
    except Exception:
        logger.exception("Backtest failed")
        sys.exit(1)
