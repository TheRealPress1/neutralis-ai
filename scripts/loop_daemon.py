#!/usr/bin/env python3
"""Looping pipeline daemon -- runs continuously with configurable interval."""

from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from neutralis.config import load_settings
from neutralis.logging import get_logger

logger = get_logger("daemon")


def main() -> None:
    settings = load_settings()
    interval = settings.pipeline.scan_interval_sec

    logger.info("Starting loop daemon (interval=%.1fs)", interval)

    from scripts.run_once import run_once

    consecutive_errors = 0
    max_consecutive_errors = 5

    while True:
        try:
            run_once()
            consecutive_errors = 0
        except KeyboardInterrupt:
            logger.info("Shutting down")
            break
        except Exception:
            consecutive_errors += 1
            logger.exception(
                "Pipeline error (%d/%d consecutive)",
                consecutive_errors,
                max_consecutive_errors,
            )
            if consecutive_errors >= max_consecutive_errors:
                logger.error("Too many consecutive errors, exiting")
                sys.exit(1)
            backoff = min(interval * (2**consecutive_errors), 300)
            logger.info("Backing off %.1fs before retry", backoff)
            time.sleep(backoff)
            continue

        logger.info("Sleeping %.1fs until next run", interval)
        time.sleep(interval)


if __name__ == "__main__":
    main()
