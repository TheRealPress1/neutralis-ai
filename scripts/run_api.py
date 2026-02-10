#!/usr/bin/env python3
"""Run the Neutralis.ai Dashboard API server."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import uvicorn

from neutralis.config import load_settings


def main() -> None:
    settings = load_settings()
    uvicorn.run(
        "neutralis.api.app:app",
        host=settings.api.host,
        port=settings.api.port,
        log_level="info",
    )


if __name__ == "__main__":
    main()
