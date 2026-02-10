"""Configuration loader -- reads from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _load_dotenv() -> None:
    """Minimal .env.local loader. No external dependency."""
    env_path = Path(__file__).resolve().parent.parent / ".env.local"
    if not env_path.exists():
        return
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip()
            if key not in os.environ:
                os.environ[key] = value


_load_dotenv()


@dataclass(frozen=True)
class KalshiConfig:
    base_url: str = "https://api.elections.kalshi.com/trade-api/v2"
    markets_path: str = "/markets"
    orderbook_path: str = "/markets/{ticker}/orderbook"
    max_reads_per_sec: int = 20
    default_market_limit: int = 1000
    orderbook_depth: int = 10


@dataclass(frozen=True)
class DatabaseConfig:
    dsn: str = field(default_factory=lambda: os.environ.get("SUPABASE_DB_URL", ""))

    def __post_init__(self) -> None:
        if not self.dsn:
            raise ValueError(
                "SUPABASE_DB_URL not set. "
                "Get it from Supabase Dashboard > Settings > Database > Connection string."
            )


@dataclass(frozen=True)
class PipelineConfig:
    scan_interval_sec: float = 30.0
    min_edge_pct: float = 1.0
    min_liquidity_dollars: float = 50.0
    max_time_to_expiry_hours: float = 720.0
    min_time_to_expiry_hours: float = 1.0
    fee_rate: float = 0.07
    max_position_dollars: float = 25.0


@dataclass(frozen=True)
class PolymarketConfig:
    gamma_base_url: str = "https://gamma-api.polymarket.com"
    clob_base_url: str = "https://clob.polymarket.com"
    default_market_limit: int = 100
    max_pages: int = 10


@dataclass(frozen=True)
class MatchingConfig:
    min_similarity: float = 0.55
    min_discrepancy_pct: float = 3.0
    min_token_overlap: int = 1


@dataclass(frozen=True)
class PortfolioConfig:
    max_total_exposure_dollars: float = 500.0
    max_event_exposure_dollars: float = 100.0
    max_ticker_exposure_dollars: float = 50.0
    max_venue_exposure_pct: float = 0.80
    max_open_positions: int = 50


@dataclass(frozen=True)
class SchedulerConfig:
    scan_interval_sec: float = 30.0
    max_consecutive_errors: int = 5
    max_backoff_sec: float = 300.0
    startup_health_check: bool = True


@dataclass(frozen=True)
class Settings:
    kalshi: KalshiConfig = field(default_factory=KalshiConfig)
    polymarket: PolymarketConfig = field(default_factory=PolymarketConfig)
    matching: MatchingConfig = field(default_factory=MatchingConfig)
    db: DatabaseConfig = field(default_factory=DatabaseConfig)
    pipeline: PipelineConfig = field(default_factory=PipelineConfig)
    portfolio: PortfolioConfig = field(default_factory=PortfolioConfig)
    scheduler: SchedulerConfig = field(default_factory=SchedulerConfig)


def load_settings() -> Settings:
    """Build and validate settings from environment."""
    return Settings()
