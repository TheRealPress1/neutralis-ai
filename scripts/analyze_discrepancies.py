#!/usr/bin/env python3
"""Discrepancy analytics — analyze cross-platform price gap observations."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from neutralis.config import DatabaseConfig
from neutralis.storage.postgres import PostgresStorage


def _bar(value: float, max_val: float, width: int = 30) -> str:
    """Simple ASCII bar chart."""
    if max_val <= 0:
        return ""
    filled = int(round(value / max_val * width))
    return "\u2588" * filled


def print_pair_summary(storage: PostgresStorage, hours: int) -> None:
    rows = storage.get_discrepancy_summary(hours)
    if not rows:
        print("  No data.\n")
        return

    print(f"  {'Pair':<30} {'Obs':>5} {'Avg%':>7} {'Max%':>7} {'Act':>4}")
    print("  " + "-" * 60)
    # Sort by max_edge_pct descending
    rows.sort(key=lambda r: float(r.get("max_edge_pct", 0)), reverse=True)
    for r in rows:
        print(
            f"  {r['kalshi_ticker']:<30} "
            f"{r['observations']:>5} "
            f"{float(r['avg_edge_pct']):>7.3f} "
            f"{float(r['max_edge_pct']):>7.3f} "
            f"{r['actionable_count']:>4}"
        )
    total_obs = sum(r["observations"] for r in rows)
    total_act = sum(r["actionable_count"] for r in rows)
    print(f"\n  Total: {total_obs} observations, {total_act} actionable across {len(rows)} pairs")


def print_distribution(storage: PostgresStorage, hours: int) -> None:
    rows = storage.get_discrepancy_distribution(hours)
    if not rows:
        print("  No data.\n")
        return

    max_count = max(r["count"] for r in rows)
    for r in rows:
        bucket = float(r["bucket"])
        count = r["count"]
        act = r["actionable"]
        bar = _bar(count, max_count, 25)
        label = f"  {bucket:>6.1f}%"
        print(f"{label} | {bar} {count:>5} (act={act})")


def print_hourly(storage: PostgresStorage, hours: int) -> None:
    rows = storage.get_discrepancy_hourly(hours)
    if not rows:
        print("  No data.\n")
        return

    max_obs = max(r["observations"] for r in rows)
    for r in rows:
        hour = r["hour"]
        obs = r["observations"]
        avg_e = float(r["avg_edge"])
        max_e = float(r["max_edge"])
        act = r["actionable"]
        bar = _bar(obs, max_obs, 20)
        print(
            f"  {hour:>2}:00 UTC | {bar} {obs:>5} obs  avg={avg_e:>6.3f}%  max={max_e:>6.3f}%  act={act}"
        )


def print_trigger(storage: PostgresStorage, hours: int) -> None:
    rows = storage.get_discrepancy_by_trigger(hours)
    if not rows:
        print("  No data.\n")
        return

    print(f"  {'Source':<15} {'Obs':>6} {'Avg%':>7} {'Max%':>7} {'Act':>4}")
    print("  " + "-" * 45)
    for r in rows:
        print(
            f"  {r['trigger_source']:<15} "
            f"{r['observations']:>6} "
            f"{float(r['avg_edge']):>7.3f} "
            f"{float(r['max_edge']):>7.3f} "
            f"{r['actionable']:>4}"
        )


def print_guards(storage: PostgresStorage) -> None:
    rows = storage.get_guard_effectiveness()
    if not rows:
        print("  No decision data.\n")
        return

    print(f"  {'Guard':<25} {'Evals':>6} {'Rejects':>8} {'Rate':>6}")
    print("  " + "-" * 50)
    for r in rows:
        rate = float(r["rejection_rate"]) * 100 if r["rejection_rate"] else 0
        print(
            f"  {r['guard_name']:<25} "
            f"{r['total_evaluations']:>6} "
            f"{r['rejections']:>8} "
            f"{rate:>5.1f}%"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze cross-platform discrepancy data")
    parser.add_argument("--hours", type=int, default=24, help="Lookback window in hours (default: 24)")
    args = parser.parse_args()

    db_cfg = DatabaseConfig()
    storage = PostgresStorage(db_cfg)

    print(f"\n{'=' * 65}")
    print(f"  DISCREPANCY ANALYTICS  (last {args.hours}h)")
    print(f"{'=' * 65}\n")

    print("1. PER-PAIR SUMMARY")
    print_pair_summary(storage, args.hours)
    print()

    print("2. EDGE DISTRIBUTION (% buckets)")
    print_distribution(storage, args.hours)
    print()

    print("3. HOURLY PATTERN (UTC)")
    print_hourly(storage, args.hours)
    print()

    print("4. TRIGGER SOURCE")
    print_trigger(storage, args.hours)
    print()

    print("5. GUARD EFFECTIVENESS (all-time)")
    print_guards(storage)
    print()

    storage.close()


if __name__ == "__main__":
    main()
