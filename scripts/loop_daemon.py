#!/usr/bin/env python3
"""Production scheduler -- runs the pipeline continuously with health checks."""

from __future__ import annotations

import signal
import sys
import threading
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from neutralis.alerts.discord import DiscordNotifier
from neutralis.config import SchedulerConfig, load_settings
from neutralis.logging import get_logger
from neutralis.storage.postgres import PostgresStorage

logger = get_logger("scheduler")


class _Stats:
    """Mutable cumulative run statistics."""

    def __init__(self) -> None:
        self.started_at = time.monotonic()
        self.total_runs = 0
        self.total_errors = 0
        self.consecutive_errors = 0
        self.total_signals = 0
        self.total_passes = 0
        self.total_rejects = 0
        self.total_settled = 0
        self.total_settlement_pnl = 0.0
        self.total_marked = 0

    def record_success(self, run_stats: object) -> None:
        self.total_runs += 1
        self.consecutive_errors = 0
        self.total_signals += getattr(run_stats, "complement_signals", 0)
        self.total_signals += getattr(run_stats, "cross_platform_signals", 0)
        self.total_passes += getattr(run_stats, "decisions_pass", 0)
        self.total_rejects += getattr(run_stats, "decisions_reject", 0)
        self.total_settled += getattr(run_stats, "positions_settled", 0)
        self.total_settlement_pnl += getattr(run_stats, "settlement_pnl", 0.0)
        self.total_marked += getattr(run_stats, "marked_positions", 0)

    def record_error(self) -> None:
        self.total_errors += 1
        self.consecutive_errors += 1

    @property
    def uptime_sec(self) -> float:
        return time.monotonic() - self.started_at


def main() -> None:
    settings = load_settings()
    cfg: SchedulerConfig = settings.scheduler

    # Startup health check — fail fast if DB is unreachable
    if cfg.startup_health_check:
        logger.info("Running startup health check")
        try:
            with PostgresStorage(settings.db):
                pass
            logger.info("Health check passed: database reachable")
        except Exception:
            logger.exception("Health check failed: database unreachable")
            sys.exit(1)

    logger.info(
        "Scheduler started (interval=%.1fs, max_errors=%d, max_backoff=%.0fs)",
        cfg.scan_interval_sec,
        cfg.max_consecutive_errors,
        cfg.max_backoff_sec,
    )

    # Signal handling for clean shutdown
    shutdown = threading.Event()

    def _handle_shutdown(signum: int, _frame: object) -> None:
        sig_name = signal.Signals(signum).name
        logger.info("Received %s, shutting down gracefully", sig_name)
        shutdown.set()

    signal.signal(signal.SIGTERM, _handle_shutdown)
    signal.signal(signal.SIGINT, _handle_shutdown)

    # Lazy import — avoid loading pipeline modules until we enter the loop
    from scripts.run_once import run_once

    notifier = DiscordNotifier(settings.alerts)
    stats = _Stats()

    while not shutdown.is_set():
        try:
            run_stats = run_once()
            stats.record_success(run_stats)

            logger.info(
                "Run #%d complete: %.0fms | signals=%d pass=%d reject=%d | "
                "positions=%d exposure=$%.2f | cumulative: %d runs, %d errors, "
                "%.0fs uptime",
                stats.total_runs,
                run_stats.duration_ms,
                run_stats.complement_signals + run_stats.cross_platform_signals,
                run_stats.decisions_pass,
                run_stats.decisions_reject,
                run_stats.open_positions,
                run_stats.total_exposure,
                stats.total_runs,
                stats.total_errors,
                stats.uptime_sec,
            )
        except Exception as exc:
            stats.record_error()
            logger.exception(
                "Pipeline error (%d/%d consecutive)",
                stats.consecutive_errors,
                cfg.max_consecutive_errors,
            )
            notifier.notify_error(
                error_msg=str(exc),
                consecutive=stats.consecutive_errors,
                max_errors=cfg.max_consecutive_errors,
            )
            if stats.consecutive_errors >= cfg.max_consecutive_errors:
                logger.error(
                    "Too many consecutive errors (%d), exiting | "
                    "total: %d runs, %d errors, %.0fs uptime",
                    stats.consecutive_errors,
                    stats.total_runs,
                    stats.total_errors,
                    stats.uptime_sec,
                )
                sys.exit(1)

            backoff = min(
                cfg.scan_interval_sec * (2 ** stats.consecutive_errors),
                cfg.max_backoff_sec,
            )
            logger.info("Backing off %.1fs before retry", backoff)
            shutdown.wait(backoff)
            continue

        shutdown.wait(cfg.scan_interval_sec)

    # Clean shutdown summary
    logger.info(
        "Scheduler stopped | %d runs, %d signals, %d passes, %d errors, %.0fs uptime",
        stats.total_runs,
        stats.total_signals,
        stats.total_passes,
        stats.total_errors,
        stats.uptime_sec,
    )


if __name__ == "__main__":
    main()
