/* TypeScript types mirroring the Python models and SQL schema. */

export interface PortfolioStats {
  open_positions: number;
  closed_positions: number;
  total_exposure: number;
  total_realized_pnl: number;
  wins: number;
  losses: number;
  win_rate: number;
  total_trades: number;
}

export interface Position {
  id: string;
  ticker: string;
  event_ticker: string;
  venue: string;
  side: "buy_yes" | "buy_no";
  status: "open" | "closed";
  entry_price: number;
  size_dollars: number;
  quantity: number;
  realized_pnl: number;
  unrealized_pnl: number;
  trade_count: number;
  opened_at: string;
  closed_at: string | null;
  category: string;
}

export interface Signal {
  id: string;
  signal_type: "complement_arb" | "cross_platform_discrepancy";
  ticker: string;
  event_ticker: string;
  yes_ask: number;
  no_ask: number;
  combined_cost: number;
  gross_edge: number;
  net_edge: number;
  edge_pct: number;
  snapshot_id: number | null;
  created_at: string;
}

export interface GuardResult {
  guard_name: string;
  passed: boolean;
  reason: string;
  value: number | null;
  threshold: number | null;
}

export interface Decision {
  id: number;
  signal_id: string;
  verdict: "pass" | "reject";
  guard_results: GuardResult[];
  suggested_size: number;
  created_at: string;
  ticker: string;
  edge_pct: number;
  signal_type: "complement_arb" | "cross_platform_discrepancy";
}

export interface MarketMatch {
  id: number;
  kalshi_ticker: string;
  kalshi_title: string;
  polymarket_id: string;
  polymarket_question: string;
  match_confidence: number;
  kalshi_snapshot_id: number | null;
  polymarket_snapshot_id: number | null;
  created_at: string;
}

export type ActivityItem =
  | { kind: "signal"; data: Signal }
  | { kind: "decision"; data: Decision };

export interface CategoryMeta {
  slug: string;
  label: string;
  color: string;
  description: string;
}

export interface CategoryOverride {
  enabled: boolean;
  risk_level: "conservative" | "moderate" | "aggressive";
  max_exposure_dollars: number | null;
}

export interface AnalyticsSummary {
  total_pnl: number;
  total_closed: number;
  best_day: number;
  worst_day: number;
  max_drawdown: number;
  avg_trade_pnl: number;
  avg_win: number;
  avg_loss: number;
}

export interface DailyPnL {
  date: string;
  pnl: number;
  trades: number;
  wins: number;
  losses: number;
}

export interface CategoryBreakdown {
  category: string;
  total_trades: number;
  wins: number;
  losses: number;
  total_pnl: number;
  avg_pnl: number;
}

export interface VenueBreakdown {
  venue: string;
  total_trades: number;
  wins: number;
  losses: number;
  total_pnl: number;
}

export interface PnLBucket {
  bucket_start: number;
  count: number;
}

export interface GuardStat {
  guard_name: string;
  total_evaluations: number;
  rejections: number;
  rejection_rate: number;
}

export interface RiskProfile {
  id: number;
  name: string;
  preset: "conservative" | "moderate" | "aggressive" | "custom";
  is_active: boolean;
  target_annual_return_pct: number;
  description: string;

  // Signal Quality
  min_edge_pct: number;
  min_liquidity_dollars: number;
  max_time_to_expiry_hours: number;
  min_time_to_expiry_hours: number;
  fee_rate: number;

  // Position Sizing
  max_position_dollars: number;

  // Portfolio Limits
  max_total_exposure_dollars: number;
  max_event_exposure_dollars: number;
  max_ticker_exposure_dollars: number;
  max_venue_exposure_pct: number;
  max_open_positions: number;

  // Matching
  min_similarity: number;

  // Category overrides
  category_overrides: Record<string, CategoryOverride>;
  strategy: string | null;

  user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}
