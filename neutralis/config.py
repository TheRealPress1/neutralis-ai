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
    series_path: str = "/series"
    events_path: str = "/events"
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
    max_time_to_expiry_hours: float = 43800.0  # ~5 years (tournament/political markets)
    min_time_to_expiry_hours: float = 1.0
    fee_rate: float = 0.07
    max_position_dollars: float = 25.0
    min_xp_edge_pct: float = 0.10  # Cross-platform arb threshold (lower — one side is fee-free)
    slippage_per_leg: float = 0.005  # $0.005 per leg execution buffer (price movement risk)


@dataclass(frozen=True)
class PolymarketConfig:
    gamma_base_url: str = "https://gamma-api.polymarket.com"
    clob_base_url: str = "https://clob.polymarket.com"
    default_market_limit: int = 100
    max_pages: int = 50


@dataclass(frozen=True)
class MatchingConfig:
    min_similarity: float = 0.65
    min_discrepancy_pct: float = 3.0
    min_token_overlap: int = 2
    weight_text: float = 0.50
    weight_entity: float = 0.35
    weight_temporal: float = 0.15
    max_liquidity_ratio: float = 10.0  # reject if venue liquidity differs >Nx
    max_spread: float = 0.40  # reject if bid-ask spread > this on either side


@dataclass(frozen=True)
class PortfolioConfig:
    max_total_exposure_dollars: float = 500.0
    max_event_exposure_dollars: float = 100.0
    max_ticker_exposure_dollars: float = 50.0
    max_venue_exposure_pct: float = 0.80
    max_open_positions: int = 50


@dataclass(frozen=True)
class ExitConfig:
    stop_loss_pct: float = 15.0
    take_profit_pct: float = 25.0
    time_decay_hours: float = 24.0
    time_decay_edge_floor_pct: float = 1.0
    min_exit_liquidity_dollars: float = 10.0
    enabled: bool = True
    # Trailing stop: exit if price drops this % from high-water mark
    trailing_stop_pct: float = 10.0
    trailing_stop_activation_pct: float = 5.0  # Only activate after position is +5%
    # Dynamic take-profit: tighten TP as expiry approaches
    # When hours_to_expiry < dynamic_tp_hours, scale TP from take_profit_pct down to dynamic_tp_floor_pct
    dynamic_tp_hours: float = 12.0
    dynamic_tp_floor_pct: float = 8.0


@dataclass(frozen=True)
class PerformanceFeeConfig:
    enabled: bool = True
    free_rate: float = 0.00
    starter_rate: float = 0.12
    pro_rate: float = 0.07
    founder_rate: float = 0.00
    min_fee_amount: float = 0.0001  # $0.0001 — skip dust entries

    def rate_for_tier(self, tier: str) -> float:
        """Return the fee rate for a subscription tier."""
        rates = {
            "free": self.free_rate,
            "starter": self.starter_rate,
            "pro": self.pro_rate,
            "founder": self.founder_rate,
        }
        return rates.get(tier, self.free_rate)


@dataclass(frozen=True)
class DirectionalConfig:
    enabled: bool = True
    min_implied_probability: float = 0.80
    probability_floor: float = 0.60
    min_liquidity_dollars: float = 50.0
    max_position_dollars: float = 50.0
    max_total_exposure_dollars: float = 1000.0
    max_event_exposure_dollars: float = 100.0
    max_ticker_exposure_dollars: float = 50.0
    max_open_positions: int = 30
    min_time_to_expiry_hours: float = 1.0
    max_time_to_expiry_hours: float = 168.0  # 7 days
    # Per-category probability thresholds (override min_implied_probability)
    # Crypto milestones are binary (BTC > $150k?) — 85% is very strong conviction
    crypto_min_probability: float = 0.85
    crypto_max_time_hours: float = 720.0  # 30 days (milestone markets resolve slower)
    # Political markets have longer horizons — require higher conviction
    politics_min_probability: float = 0.88
    politics_max_time_hours: float = 2160.0  # 90 days
    # Categories to scan (in addition to sports which is always on)
    extra_categories: tuple[str, ...] = ("crypto", "politics")


@dataclass(frozen=True)
class ExecutionConfig:
    live_trading_enabled: bool = field(
        default_factory=lambda: os.environ.get("LIVE_TRADING_ENABLED", "").lower()
        in ("true", "1", "yes")
    )
    kalshi_api_key_id: str = field(
        default_factory=lambda: os.environ.get("KALSHI_API_KEY_ID", "")
    )
    kalshi_private_key_path: str = field(
        default_factory=lambda: os.environ.get("KALSHI_PRIVATE_KEY_PATH", "")
    )
    # Polymarket CLOB execution credentials
    polymarket_private_key: str = field(
        default_factory=lambda: os.environ.get("POLYMARKET_PRIVATE_KEY", "")
    )
    polymarket_funder_address: str = field(
        default_factory=lambda: os.environ.get("POLYMARKET_FUNDER_ADDRESS", "")
    )
    polymarket_signature_type: int = field(
        default_factory=lambda: int(os.environ.get("POLYMARKET_SIGNATURE_TYPE", "0"))
    )
    max_order_dollars: float = 50.0
    balance_floor_dollars: float = 25.0
    # Maker order strategy — GTC limit orders for lower Kalshi fees (4x cheaper)
    use_maker_orders: bool = True
    maker_price_offset_cents: int = 1  # Post N cents inside the spread (bid + offset)
    maker_fill_timeout_sec: float = 10.0  # Cancel unfilled GTC order after this


@dataclass(frozen=True)
class MarketFilterConfig:
    enabled: bool = True
    category_whitelist: tuple[str, ...] = ("politics", "economics", "crypto")
    incremental_updates: bool = True
    full_refresh_interval_sec: float = 300.0
    # Series with known cross-platform overlap (Polymarket counterparts exist)
    priority_series: tuple[str, ...] = (
        # Soccer tournament winners
        "KXPREMIERLEAGUE", "KXUCL", "KXFACUP", "KXLALIGA",
        "KXBUNDESLIGA", "KXSERIEA", "KXLIGUE1",
        "KXEUROPALEAGUE", "KXMLSWINNER",
        # Soccer match 3-way markets (Team A / Team B / Draw)
        "KXEPLGAME", "KXBUNDESLIGAGAME", "KXLIGUE1GAME",
        "KXSERIEAGAME", "KXBRASILEIROGAME", "KXSCOTTISHPREMGAME", "KXUEFAGAME",
        # Tennis
        "KXATPMATCH", "KXWTAMATCH",
        # American sports
        "KXNBA", "KXNFL",
        "KXNBAMVP", "KXNBAEAST", "KXNBAWEST",
        # Crypto milestones (Polymarket has BTC/ETH milestone markets)
        "KXBTCMAXY", "KXBTCMINY", "KXETHMAXY", "KXETHMINY",
        "KXBTC2026200", "KXBTC2026250", "KXCRYPTORESERVE",
        # Economics (Polymarket has Fed/inflation/GDP markets)
        "KXFEDDECISION", "KXRATECUT", "KXFED", "KXCPIYOY", "KXGDP",
        # Political
        "KXFEDCHAIRNOM", "KXPRESPARTY",
        "KXSENATE", "KXGOVCA",
        # Entertainment (Polymarket has Oscar/Nobel markets)
        "KXOSCARPIC", "KXOSCARACTO", "KXOSCARACTR", "KXOSCARDIR",
        "KXNOBELPEACE",
    )


@dataclass(frozen=True)
class WebSocketConfig:
    enabled: bool = field(
        default_factory=lambda: os.environ.get("WEBSOCKET_ENABLED", "").lower()
        in ("true", "1", "yes")
    )
    ws_url: str = "wss://api.elections.kalshi.com/trade-api/ws/v2"
    reconnect_delay_sec: float = 1.0
    max_reconnect_delay_sec: float = 60.0
    health_port: int = 9091
    # Focus on high-crossover categories for real-time arb detection
    focus_categories: tuple[str, ...] = ("Sports", "Crypto", "Politics")
    # How often to run periodic tasks (settlement, MTM, full REST refresh)
    settlement_interval_sec: float = 60.0
    mtm_interval_sec: float = 30.0
    rest_refresh_interval_sec: float = 300.0
    # Max markets to subscribe to on WS (performance guard)
    max_ws_subscriptions: int = 2000


@dataclass(frozen=True)
class PolymarketWSConfig:
    enabled: bool = field(
        default_factory=lambda: os.environ.get("POLYMARKET_WS_ENABLED", "").lower()
        in ("true", "1", "yes")
    )
    ws_url: str = "wss://ws-subscriptions-clob.polymarket.com/ws/market"
    reconnect_delay_sec: float = 1.0
    max_reconnect_delay_sec: float = 60.0
    max_subscriptions: int = 500


@dataclass(frozen=True)
class SchedulerConfig:
    scan_interval_sec: float = 30.0
    max_consecutive_errors: int = 5
    max_backoff_sec: float = 300.0
    startup_health_check: bool = True
    heartbeat_every_n_runs: int = 10
    health_port: int = 9090


@dataclass(frozen=True)
class APIConfig:
    host: str = "0.0.0.0"
    port: int = 8000


@dataclass(frozen=True)
class AlertsConfig:
    discord_webhook_url: str = field(
        default_factory=lambda: os.environ.get("DISCORD_WEBHOOK_URL", "")
    )
    enabled: bool = True


@dataclass(frozen=True)
class Settings:
    kalshi: KalshiConfig = field(default_factory=KalshiConfig)
    polymarket: PolymarketConfig = field(default_factory=PolymarketConfig)
    matching: MatchingConfig = field(default_factory=MatchingConfig)
    db: DatabaseConfig = field(default_factory=DatabaseConfig)
    pipeline: PipelineConfig = field(default_factory=PipelineConfig)
    portfolio: PortfolioConfig = field(default_factory=PortfolioConfig)
    scheduler: SchedulerConfig = field(default_factory=SchedulerConfig)
    api: APIConfig = field(default_factory=APIConfig)
    alerts: AlertsConfig = field(default_factory=AlertsConfig)
    exits: ExitConfig = field(default_factory=ExitConfig)
    execution: ExecutionConfig = field(default_factory=ExecutionConfig)
    market_filter: MarketFilterConfig = field(default_factory=MarketFilterConfig)
    websocket: WebSocketConfig = field(default_factory=WebSocketConfig)
    polymarket_ws: PolymarketWSConfig = field(default_factory=PolymarketWSConfig)
    directional: DirectionalConfig = field(default_factory=DirectionalConfig)
    performance_fees: PerformanceFeeConfig = field(default_factory=PerformanceFeeConfig)


def load_settings() -> Settings:
    """Build and validate settings from environment."""
    return Settings()


def load_settings_with_profile(storage: object) -> Settings:
    """Build settings, overriding pipeline/portfolio/matching from the active DB profile.

    Falls back to environment defaults if no profile exists or DB query fails.
    """
    from neutralis.profiles import load_active_profile

    base = Settings()

    try:
        profile = load_active_profile(storage)
    except Exception:
        import logging
        logging.getLogger(__name__).warning(
            "Failed to load risk profile from DB, using env defaults",
            exc_info=True,
        )
        return base

    if profile is None:
        return base

    return Settings(
        kalshi=base.kalshi,
        polymarket=base.polymarket,
        matching=profile.to_matching_config(),
        db=base.db,
        pipeline=profile.to_pipeline_config(),
        portfolio=profile.to_portfolio_config(),
        scheduler=base.scheduler,
        api=base.api,
        alerts=base.alerts,
        exits=base.exits,
        execution=base.execution,
        market_filter=base.market_filter,
        websocket=base.websocket,
        polymarket_ws=base.polymarket_ws,
        performance_fees=base.performance_fees,
    )
