#!/usr/bin/env python3
"""Production scheduler -- runs the pipeline continuously with health checks."""

from __future__ import annotations

import json
import signal
import sys
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from neutralis.alerts.discord import DiscordNotifier
from neutralis.config import SchedulerConfig, load_settings
from neutralis.logging import get_logger
from neutralis.storage.postgres import PostgresStorage

logger = get_logger("scheduler")


class _Stats:
    """Mutable cumulative run statistics (thread-safe)."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.started_at = time.monotonic()
        self.started_at_utc = datetime.now(timezone.utc)
        self.total_runs = 0
        self.total_errors = 0
        self.consecutive_errors = 0
        self.total_signals = 0
        self.total_passes = 0
        self.total_rejects = 0
        self.total_settled = 0
        self.total_settlement_pnl = 0.0
        self.total_marked = 0
        self.total_exits = 0
        self.total_exit_pnl = 0.0
        self.last_regime: str = "normal"
        self.last_run_at: datetime | None = None

    def record_success(self, run_stats: object) -> None:
        with self._lock:
            self.total_runs += 1
            self.consecutive_errors = 0
            self.total_signals += getattr(run_stats, "complement_signals", 0)
            self.total_signals += getattr(run_stats, "cross_platform_signals", 0)
            self.total_passes += getattr(run_stats, "decisions_pass", 0)
            self.total_rejects += getattr(run_stats, "decisions_reject", 0)
            self.total_settled += getattr(run_stats, "positions_settled", 0)
            self.total_settlement_pnl += getattr(run_stats, "settlement_pnl", 0.0)
            self.total_marked += getattr(run_stats, "marked_positions", 0)
            self.total_exits += getattr(run_stats, "exits_triggered", 0)
            self.total_exit_pnl += getattr(run_stats, "exit_pnl", 0.0)
            self.last_regime = getattr(run_stats, "regime", "normal")
            self.last_run_at = datetime.now(timezone.utc)

    def record_error(self) -> None:
        with self._lock:
            self.total_errors += 1
            self.consecutive_errors += 1

    @property
    def uptime_sec(self) -> float:
        return time.monotonic() - self.started_at

    def health_snapshot(self) -> dict:
        """Thread-safe snapshot for the health endpoint."""
        with self._lock:
            consecutive = self.consecutive_errors
            total_runs = self.total_runs
            last_run = self.last_run_at

        if consecutive == 0:
            status = "ok"
        elif consecutive < 3:
            status = "degraded"
        else:
            status = "error"

        return {
            "status": status,
            "uptime_sec": round(self.uptime_sec, 1),
            "started_at": self.started_at_utc.isoformat(),
            "last_run_at": last_run.isoformat() if last_run else None,
            "total_runs": total_runs,
            "consecutive_errors": consecutive,
        }


def _start_health_server(stats: _Stats, port: int) -> None:
    """Start a minimal HTTP health server on a background daemon thread."""

    class _Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            if self.path != "/health":
                self.send_response(404)
                self.end_headers()
                return
            body = json.dumps(stats.health_snapshot())
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body.encode())

        def log_message(self, format: str, *args: object) -> None:
            pass  # suppress default stderr logging

    try:
        server = HTTPServer(("0.0.0.0", port), _Handler)
    except OSError:
        logger.warning("Health server failed to bind to port %d", port, exc_info=True)
        return

    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    logger.info("Health server listening on port %d", port)


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
        "Scheduler started (interval=%.1fs, max_errors=%d, max_backoff=%.0fs, "
        "heartbeat_every=%d, health_port=%d)",
        cfg.scan_interval_sec,
        cfg.max_consecutive_errors,
        cfg.max_backoff_sec,
        cfg.heartbeat_every_n_runs,
        cfg.health_port,
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
    import scripts.run_once as _pipeline

    # Initialize market cache for category-filtered fetching
    from neutralis.venues.market_cache import MarketCache
    _pipeline._market_cache = MarketCache()
    logger.info("Market cache initialized (filter=%s)", settings.market_filter.enabled)

    notifier = DiscordNotifier(settings.alerts)
    stats = _Stats()

    # Start health endpoint
    _start_health_server(stats, cfg.health_port)

    # Persistent DB connection for automation state checks
    _state_storage = PostgresStorage(settings.db)
    _state_storage.connect()

    while not shutdown.is_set():
        # ── Check automation state ──────────────────────────────
        try:
            auto_state = _state_storage.get_automation_state()
            if auto_state:
                if auto_state["status"] == "paused":
                    logger.debug("Automation paused, skipping run")
                    shutdown.wait(cfg.scan_interval_sec)
                    continue
                if auto_state["status"] == "killed":
                    logger.info(
                        "Automation killed: %s", auto_state.get("killed_reason")
                    )
                    break
        except Exception:
            logger.warning("Failed to check automation state", exc_info=True)

        try:
            run_stats = run_once(run_number=stats.total_runs)
            stats.record_success(run_stats)

            # Persist per-run metrics
            try:
                with PostgresStorage(settings.db) as run_storage:
                    run_storage.save_scheduler_run(stats.total_runs, run_stats)
            except Exception:
                logger.warning("Failed to persist scheduler run metrics", exc_info=True)

            # Update automation state risk metrics
            try:
                _state_storage.update_automation_metrics(
                    daily_loss=getattr(run_stats, "daily_loss", 0.0),
                    peak_value=getattr(run_stats, "peak_portfolio_value", 0.0),
                    max_drawdown=getattr(run_stats, "max_drawdown", 0.0),
                )
            except Exception:
                logger.warning("Failed to update automation metrics", exc_info=True)

            # Heartbeat alert
            if (
                cfg.heartbeat_every_n_runs > 0
                and stats.total_runs % cfg.heartbeat_every_n_runs == 0
            ):
                notifier.notify_heartbeat(
                    uptime_sec=stats.uptime_sec,
                    total_runs=stats.total_runs,
                    total_errors=stats.total_errors,
                    total_pnl=stats.total_settlement_pnl,
                    total_exit_pnl=stats.total_exit_pnl,
                    regime=stats.last_regime,
                )

            logger.info(
                "Run #%d complete: %.0fms | signals=%d pass=%d reject=%d | "
                "positions=%d exposure=$%.2f | exits=%d exit_pnl=$%.2f | "
                "cumulative: %d runs, %d errors, %.0fs uptime",
                stats.total_runs,
                run_stats.duration_ms,
                run_stats.complement_signals + run_stats.cross_platform_signals,
                run_stats.decisions_pass,
                run_stats.decisions_reject,
                run_stats.open_positions,
                run_stats.total_exposure,
                run_stats.exits_triggered,
                run_stats.exit_pnl,
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

    # Close state storage connection
    _state_storage.close()

    # Clean shutdown summary
    logger.info(
        "Scheduler stopped | %d runs, %d signals, %d passes, %d exits, "
        "%d errors, %.0fs uptime",
        stats.total_runs,
        stats.total_signals,
        stats.total_passes,
        stats.total_exits,
        stats.total_errors,
        stats.uptime_sec,
    )


if __name__ == "__main__":
    main()
