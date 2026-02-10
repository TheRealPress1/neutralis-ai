/* Typed fetch client for the FastAPI dashboard endpoints. */

import type {
  AnalyticsSummary,
  BacktestDataRange,
  BacktestRequest,
  BacktestResult,
  CategoryBreakdown,
  CategoryMeta,
  DailyPnL,
  DecisionReasons,
  EnrichedSignal,
  ExecutionStats,
  Fill,
  GuardStat,
  OptimizerRequest,
  OptimizerRun,
  Order,
  PnLBucket,
  PortfolioStats,
  Position,
  RegimeState,
  Signal,
  Decision,
  MarketMatch,
  RiskProfile,
  VenueBreakdown,
} from "@/types/api";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch<T>(
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(path, API_BASE);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function fetchPortfolioStats() {
  return apiFetch<PortfolioStats>("/api/portfolio/stats");
}

export function fetchPositions(status: "open" | "closed", limit = 50) {
  return apiFetch<Position[]>("/api/positions", {
    status,
    limit: String(limit),
  });
}

export function fetchSignals(limit = 20) {
  return apiFetch<Signal[]>("/api/signals", { limit: String(limit) });
}

export function fetchDecisions(limit = 20) {
  return apiFetch<Decision[]>("/api/decisions", { limit: String(limit) });
}

export function fetchEnrichedSignals(
  limit = 50,
  filters?: {
    min_confidence?: number;
    signal_type?: string;
    verdict?: string;
  },
) {
  const params: Record<string, string> = { limit: String(limit) };
  if (filters?.min_confidence) params.min_confidence = String(filters.min_confidence);
  if (filters?.signal_type) params.signal_type = filters.signal_type;
  if (filters?.verdict) params.verdict = filters.verdict;
  return apiFetch<EnrichedSignal[]>("/api/signals/enriched", params);
}

export function fetchCurrentRegime() {
  return apiFetch<RegimeState>("/api/regime/current");
}

export function fetchMatches(limit = 25) {
  return apiFetch<MarketMatch[]>("/api/matches", { limit: String(limit) });
}

// --- Execution ---

export function fetchOrders(limit = 50, status?: string) {
  const params: Record<string, string> = { limit: String(limit) };
  if (status) params.status = status;
  return apiFetch<Order[]>("/api/orders", params);
}

export function fetchFills(limit = 50) {
  return apiFetch<Fill[]>("/api/fills", { limit: String(limit) });
}

export function fetchFillsForOrder(orderId: string) {
  return apiFetch<Fill[]>(`/api/fills/${orderId}`);
}

export function fetchDecisionReasons(decisionId: number) {
  return apiFetch<DecisionReasons>(`/api/decisions/${decisionId}/reasons`);
}

export function fetchExecutionStats() {
  return apiFetch<ExecutionStats>("/api/execution/stats");
}

// --- Analytics ---

export function fetchAnalyticsSummary() {
  return apiFetch<AnalyticsSummary>("/api/analytics/summary");
}

export function fetchPnLTimeline(days = 90) {
  return apiFetch<DailyPnL[]>("/api/analytics/pnl-timeline", {
    days: String(days),
  });
}

export function fetchBreakdown() {
  return apiFetch<{
    by_category: CategoryBreakdown[];
    by_venue: VenueBreakdown[];
    pnl_distribution: PnLBucket[];
  }>("/api/analytics/breakdown");
}

export function fetchGuardStats() {
  return apiFetch<GuardStat[]>("/api/analytics/guard-stats");
}

// --- Risk Profiles ---

export function fetchCategories() {
  return apiFetch<CategoryMeta[]>("/api/categories");
}

export function fetchProfiles() {
  return apiFetch<RiskProfile[]>("/api/profiles");
}

export function fetchActiveProfile() {
  return apiFetch<RiskProfile>("/api/profiles/active");
}

export async function updateProfile(
  profileId: number,
  updates: Partial<
    Omit<RiskProfile, "id" | "is_active" | "user_id" | "created_at" | "updated_at">
  >,
): Promise<RiskProfile> {
  const url = new URL(`/api/profiles/${profileId}`, API_BASE);
  const res = await fetch(url.toString(), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json() as Promise<RiskProfile>;
}

export async function activateProfile(
  profileId: number,
): Promise<RiskProfile> {
  const url = new URL(`/api/profiles/${profileId}/activate`, API_BASE);
  const res = await fetch(url.toString(), { method: "PUT" });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json() as Promise<RiskProfile>;
}

// --- Backtest ---

export function fetchBacktestDataRange() {
  return apiFetch<BacktestDataRange>("/api/backtest/data-range");
}

export async function runBacktest(
  req: BacktestRequest,
): Promise<BacktestResult> {
  const url = new URL("/api/backtest/run", API_BASE);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Backtest failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<BacktestResult>;
}

// --- Optimizer ---

export async function runOptimization(
  req: OptimizerRequest,
): Promise<OptimizerRun> {
  const url = new URL("/api/backtest/optimize", API_BASE);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Optimization failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<OptimizerRun>;
}

export function fetchOptimizerProgress(runId: number) {
  return apiFetch<OptimizerRun>(`/api/backtest/optimize/${runId}/progress`);
}
