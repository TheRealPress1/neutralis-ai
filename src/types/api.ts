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

  // Daily loss limit
  daily_loss_limit_dollars: number;

  user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// --- Automation / Kill Switch ---

export interface AutomationState {
  id?: number;
  status: "running" | "paused" | "killed";
  kill_switch: boolean;
  killed_reason: string | null;
  paused_at: string | null;
  killed_at: string | null;
  started_at: string | null;
  daily_loss_dollars: number;
  daily_loss_reset_at: string | null;
  peak_portfolio_value: number;
  max_drawdown_dollars: number;
  updated_at: string | null;
}

// --- Audit Logs ---

export interface AuditLogEntry {
  id: number;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}
