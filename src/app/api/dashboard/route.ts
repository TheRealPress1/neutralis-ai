import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createHash } from "crypto";
import { tryEncrypt } from "@/lib/encryption";

import type {
  PortfolioStats,
  Position,
  Signal,
  Decision,
  MarketMatch,
  ArbSignal,
  AnalyticsSummary,
  DailyPnL,
  CategoryBreakdown,
  VenueBreakdown,
  PnLBucket,
  GuardStat,
  GuardResult,
  EnrichedSignal,
  RegimeState,
  Order,
  Fill,
  ExecutionStats,
  DecisionReasons,
  AutomationState,
} from "@/types/api";

function json<T>(data: T) {
  return NextResponse.json(data);
}

function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  if (!type) return err("Missing ?type= parameter");

  // Authenticate: get the current user from session cookies
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return err("Unauthorized", 401);
  const userId = user.id;

  // Service client for bypassing RLS (we filter by user_id ourselves)
  const supabase = createServiceClient();

  try {
    switch (type) {
      // Per-user data (scoped by userId)
      case "stats":
        return json(await getStats(supabase, userId));
      case "positions":
        return json(await getPositions(supabase, searchParams, userId));
      case "signals":
        return json(await getSignals(supabase, searchParams, userId));
      case "decisions":
        return json(await getDecisions(supabase, searchParams, userId));
      case "analytics-summary":
        return json(await getAnalyticsSummary(supabase, userId));
      case "pnl-timeline":
        return json(await getPnLTimeline(supabase, searchParams, userId));
      case "breakdown":
        return json(await getBreakdown(supabase, userId));
      case "guard-stats":
        return json(await getGuardStats(supabase, userId));
      case "enriched-signals":
        return json(await getEnrichedSignals(supabase, searchParams, userId));
      case "orders":
        return json(await getOrders(supabase, searchParams, userId));
      case "fills":
        return json(await getFills(supabase, searchParams, userId));
      case "execution-stats":
        return json(await getExecutionStats(supabase, userId));
      case "decision-reasons":
        return json(await getDecisionReasons(supabase, searchParams, userId));
      case "automation-state":
        return json(await getAutomationState(supabase, userId));

      // Encryption key diagnostic (admin only)
      case "enc-check": {
        const keyHex = process.env.API_KEY_ENC_KEY ?? "";
        const fingerprint = keyHex
          ? createHash("sha256").update(keyHex).digest("hex").slice(0, 16)
          : "missing";
        const testToken = tryEncrypt("neutralis-enc-ok");
        return json({
          fingerprint,
          configured: keyHex.length === 64,
        });
      }

      // Global data (not user-scoped)
      case "matches":
        return json(await getMatches(supabase, searchParams));
      case "arb-signals":
        return json(await getArbSignals(supabase, searchParams));
      case "regime":
        return json(await getRegime(supabase));

      default:
        return err(`Unknown type: ${type}`);
    }
  } catch (e: any) {
    console.error(`Dashboard API error (type=${type}):`, e.message);
    return err("Internal server error", 500);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

type SB = ReturnType<typeof createServiceClient>;

async function getStats(supabase: SB, userId: string): Promise<PortfolioStats> {
  const { data: openData } = await supabase
    .from("positions")
    .select("size_dollars")
    .eq("status", "open")
    .eq("user_id", userId);

  const openPositions = openData?.length ?? 0;
  const totalExposure = openData?.reduce((s, r) => s + (r.size_dollars ?? 0), 0) ?? 0;

  const { data: closedData } = await supabase
    .from("positions")
    .select("realized_pnl")
    .eq("status", "closed")
    .eq("user_id", userId);

  const totalTrades = closedData?.length ?? 0;
  const totalRealizedPnl = closedData?.reduce((s, r) => s + (r.realized_pnl ?? 0), 0) ?? 0;
  const wins = closedData?.filter((r) => r.realized_pnl > 0).length ?? 0;
  const losses = totalTrades - wins;
  const winRate = totalTrades > 0 ? wins / totalTrades : 0;

  return {
    open_positions: openPositions,
    closed_positions: totalTrades,
    total_exposure: totalExposure,
    total_realized_pnl: totalRealizedPnl,
    wins,
    losses,
    win_rate: winRate,
    total_trades: totalTrades,
  };
}

async function getPositions(supabase: SB, params: URLSearchParams, userId: string): Promise<Position[]> {
  const status = params.get("status") ?? "open";
  const limit = Math.min(Number(params.get("limit") ?? 50), 200);

  const { data } = await supabase
    .from("positions")
    .select("*")
    .eq("status", status)
    .eq("user_id", userId)
    .order("opened_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as Position[];
}

async function getSignals(supabase: SB, params: URLSearchParams, userId: string): Promise<Signal[]> {
  const limit = Math.min(Number(params.get("limit") ?? 20), 200);

  const { data } = await supabase
    .from("signals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as Signal[];
}

async function getDecisions(supabase: SB, params: URLSearchParams, userId: string): Promise<Decision[]> {
  const limit = Math.min(Number(params.get("limit") ?? 20), 200);

  const { data } = await supabase
    .from("decisions")
    .select(`
      id, signal_id, verdict, guard_results, suggested_size, created_at,
      signals ( ticker, edge_pct, signal_type )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  // Flatten the nested signals object
  return (data ?? []).map((row: any) => ({
    id: row.id,
    signal_id: row.signal_id,
    verdict: row.verdict,
    guard_results: row.guard_results,
    suggested_size: row.suggested_size,
    created_at: row.created_at,
    ticker: row.signals?.ticker ?? "",
    edge_pct: row.signals?.edge_pct ?? 0,
    signal_type: row.signals?.signal_type ?? "complement_arb",
  })) as Decision[];
}

async function getMatches(supabase: SB, params: URLSearchParams): Promise<MarketMatch[]> {
  const limit = Math.min(Number(params.get("limit") ?? 25), 200);

  const { data } = await supabase
    .from("market_matches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as MarketMatch[];
}

async function getArbSignals(supabase: SB, params: URLSearchParams): Promise<ArbSignal[]> {
  const limit = Math.min(Number(params.get("limit") ?? 50), 200);

  const { data } = await supabase
    .from("arb_signals")
    .select(`
      id, mapping_id, ts, kalshi_bid, kalshi_ask, poly_bid, poly_ask,
      edge_kalshi_to_poly, edge_poly_to_kalshi,
      market_mappings ( kalshi_ticker, title )
    `)
    .order("ts", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row: any) => ({
    id: row.id,
    mapping_id: row.mapping_id,
    ts: row.ts,
    kalshi_bid: row.kalshi_bid,
    kalshi_ask: row.kalshi_ask,
    poly_bid: row.poly_bid,
    poly_ask: row.poly_ask,
    edge_kalshi_to_poly: row.edge_kalshi_to_poly,
    edge_poly_to_kalshi: row.edge_poly_to_kalshi,
    kalshi_ticker: row.market_mappings?.kalshi_ticker ?? "",
    title: row.market_mappings?.title ?? "",
  })) as ArbSignal[];
}

async function getAnalyticsSummary(supabase: SB, userId: string): Promise<AnalyticsSummary> {
  const { data: closed } = await supabase
    .from("positions")
    .select("realized_pnl, closed_at")
    .eq("status", "closed")
    .eq("user_id", userId);

  if (!closed || closed.length === 0) {
    return {
      total_pnl: 0, total_closed: 0, avg_trade_pnl: 0,
      max_drawdown: 0, best_day: 0, worst_day: 0, avg_win: 0, avg_loss: 0,
    };
  }

  const totalPnl = closed.reduce((s, r) => s + r.realized_pnl, 0);
  const totalClosed = closed.length;
  const avgTradePnl = totalPnl / totalClosed;

  const wins = closed.filter((r) => r.realized_pnl > 0);
  const losses = closed.filter((r) => r.realized_pnl < 0);
  const avgWin = wins.length > 0 ? wins.reduce((s, r) => s + r.realized_pnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, r) => s + r.realized_pnl, 0) / losses.length : 0;

  // Daily P&L for best/worst day and drawdown
  const dailyMap = new Map<string, number>();
  for (const p of closed) {
    if (!p.closed_at) continue;
    const date = p.closed_at.slice(0, 10);
    dailyMap.set(date, (dailyMap.get(date) ?? 0) + p.realized_pnl);
  }
  const dailyPnls = Array.from(dailyMap.values());
  const bestDay = dailyPnls.length > 0 ? Math.max(...dailyPnls) : 0;
  const worstDay = dailyPnls.length > 0 ? Math.min(...dailyPnls) : 0;

  // Max drawdown from cumulative P&L
  let peak = 0;
  let maxDrawdown = 0;
  let cum = 0;
  // Sort by date
  const sortedDates = Array.from(dailyMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [, pnl] of sortedDates) {
    cum += pnl;
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  return {
    total_pnl: totalPnl,
    total_closed: totalClosed,
    avg_trade_pnl: avgTradePnl,
    max_drawdown: maxDrawdown,
    best_day: bestDay,
    worst_day: worstDay,
    avg_win: avgWin,
    avg_loss: avgLoss,
  };
}

async function getPnLTimeline(supabase: SB, params: URLSearchParams, userId: string): Promise<DailyPnL[]> {
  const days = Math.min(Number(params.get("days") ?? 30), 365);
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { data } = await supabase
    .from("positions")
    .select("realized_pnl, closed_at")
    .eq("status", "closed")
    .eq("user_id", userId)
    .gte("closed_at", since)
    .order("closed_at", { ascending: true });

  const dailyMap = new Map<string, { pnl: number; losses: number }>();
  for (const p of data ?? []) {
    if (!p.closed_at) continue;
    const date = p.closed_at.slice(0, 10);
    const entry = dailyMap.get(date) ?? { pnl: 0, losses: 0 };
    entry.pnl += p.realized_pnl;
    if (p.realized_pnl < 0) entry.losses += Math.abs(p.realized_pnl);
    dailyMap.set(date, entry);
  }

  return Array.from(dailyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({ date, pnl: v.pnl, losses: v.losses }));
}

async function getBreakdown(supabase: SB, userId: string): Promise<{
  by_category: CategoryBreakdown[];
  by_venue: VenueBreakdown[];
  pnl_distribution: PnLBucket[];
}> {
  const { data: closed } = await supabase
    .from("positions")
    .select("realized_pnl, category, venue")
    .eq("status", "closed")
    .eq("user_id", userId);

  if (!closed || closed.length === 0) {
    return { by_category: [], by_venue: [], pnl_distribution: [] };
  }

  // By category
  const catMap = new Map<string, number>();
  for (const p of closed) {
    const cat = p.category ?? "other";
    catMap.set(cat, (catMap.get(cat) ?? 0) + p.realized_pnl);
  }
  const by_category: CategoryBreakdown[] = Array.from(catMap.entries())
    .map(([category, total_pnl]) => ({ category, total_pnl }))
    .sort((a, b) => b.total_pnl - a.total_pnl);

  // By venue
  const venueMap = new Map<string, { trades: number; pnl: number }>();
  for (const p of closed) {
    const v = p.venue ?? "unknown";
    const entry = venueMap.get(v) ?? { trades: 0, pnl: 0 };
    entry.trades++;
    entry.pnl += p.realized_pnl;
    venueMap.set(v, entry);
  }
  const by_venue: VenueBreakdown[] = Array.from(venueMap.entries()).map(
    ([venue, v]) => ({ venue, total_trades: v.trades, total_pnl: v.pnl }),
  );

  // P&L distribution (histogram)
  const bucketSize = 0.5;
  const bucketMap = new Map<number, number>();
  for (const p of closed) {
    const start = Math.floor(p.realized_pnl / bucketSize) * bucketSize;
    bucketMap.set(start, (bucketMap.get(start) ?? 0) + 1);
  }
  const pnl_distribution: PnLBucket[] = Array.from(bucketMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([bucket_start, count]) => ({ bucket_start, count }));

  return { by_category, by_venue, pnl_distribution };
}

async function getGuardStats(supabase: SB, userId: string): Promise<GuardStat[]> {
  const { data } = await supabase
    .from("decisions")
    .select("guard_results")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1000);

  const guardMap = new Map<string, { rejections: number; total: number }>();
  for (const row of data ?? []) {
    const results = (row.guard_results ?? []) as GuardResult[];
    for (const g of results) {
      const entry = guardMap.get(g.guard_name) ?? { rejections: 0, total: 0 };
      entry.total++;
      if (!g.passed) entry.rejections++;
      guardMap.set(g.guard_name, entry);
    }
  }

  return Array.from(guardMap.entries())
    .map(([guard_name, v]) => ({
      guard_name,
      rejections: v.rejections,
      total_evaluations: v.total,
      rejection_rate: v.total > 0 ? v.rejections / v.total : 0,
    }))
    .sort((a, b) => b.rejection_rate - a.rejection_rate);
}

async function getEnrichedSignals(supabase: SB, params: URLSearchParams, userId: string): Promise<EnrichedSignal[]> {
  const limit = Math.min(Number(params.get("limit") ?? 50), 200);

  const { data } = await supabase
    .from("signals")
    .select(`
      id, ticker, signal_type, confidence_score, edge_pct, roi_per_day, created_at,
      decisions ( verdict, selected, guard_results, allocation_reasons )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row: any) => {
    const d = Array.isArray(row.decisions) ? row.decisions[0] : row.decisions;
    return {
      id: row.id,
      ticker: row.ticker,
      signal_type: row.signal_type,
      confidence_score: row.confidence_score ?? 0,
      edge_pct: row.edge_pct,
      roi_per_day: row.roi_per_day ?? 0,
      signal_created_at: row.created_at,
      verdict: d?.verdict ?? null,
      selected: d?.selected ?? false,
      guard_results: d?.guard_results ?? [],
      allocation_reasons: d?.allocation_reasons ?? [],
    };
  }) as EnrichedSignal[];
}

async function getRegime(supabase: SB): Promise<RegimeState> {
  const { data } = await supabase
    .from("regime_states")
    .select("regime, metrics_json, params_json")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!data) {
    return { regime: "normal", metrics_json: {}, params_json: {} };
  }
  return data as RegimeState;
}

async function getOrders(supabase: SB, params: URLSearchParams, userId: string): Promise<Order[]> {
  const limit = Math.min(Number(params.get("limit") ?? 50), 200);
  const status = params.get("status");

  let query = supabase
    .from("orders")
    .select("id, ticker, venue, side, decision_id, status, requested_price, requested_size_dollars, filled_size_dollars, avg_fill_price, slippage_bps, fees_dollars, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq("status", status);
  }

  const { data } = await query;
  return (data ?? []) as Order[];
}

async function getFills(supabase: SB, params: URLSearchParams, userId: string): Promise<Fill[]> {
  const limit = Math.min(Number(params.get("limit") ?? 50), 200);

  const { data } = await supabase
    .from("fills")
    .select(`
      id, order_id, fill_number, price, quantity, size_dollars, fee_dollars, slippage_bps, created_at,
      orders ( ticker, side, requested_price )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row: any) => ({
    id: row.id,
    order_id: row.order_id,
    fill_number: row.fill_number,
    price: row.price,
    quantity: row.quantity,
    size_dollars: row.size_dollars,
    fee_dollars: row.fee_dollars,
    slippage_bps: row.slippage_bps,
    created_at: row.created_at,
    ticker: row.orders?.ticker,
    side: row.orders?.side,
    requested_price: row.orders?.requested_price,
  })) as Fill[];
}

async function getExecutionStats(supabase: SB, userId: string): Promise<ExecutionStats> {
  const { data } = await supabase
    .from("orders")
    .select("status, slippage_bps, fees_dollars")
    .eq("user_id", userId);

  if (!data || data.length === 0) {
    return { total_orders: 0, filled: 0, partial: 0, cancelled: 0, avg_slippage_bps: 0, total_fees: 0 };
  }

  const filled = data.filter((r) => r.status === "filled").length;
  const partial = data.filter((r) => r.status === "partial").length;
  const cancelled = data.filter((r) => r.status === "cancelled").length;
  const slippages = data.filter((r) => r.slippage_bps != null).map((r) => r.slippage_bps as number);
  const avgSlippage = slippages.length > 0 ? slippages.reduce((s, v) => s + v, 0) / slippages.length : 0;
  const totalFees = data.reduce((s, r) => s + (r.fees_dollars ?? 0), 0);

  return {
    total_orders: data.length,
    filled,
    partial,
    cancelled,
    avg_slippage_bps: avgSlippage,
    total_fees: totalFees,
  };
}

async function getDecisionReasons(supabase: SB, params: URLSearchParams, userId: string): Promise<DecisionReasons | null> {
  const id = params.get("id");
  if (!id) return null;

  const { data } = await supabase
    .from("decisions")
    .select(`
      id, verdict, guard_results, suggested_size, selected, selection_score, allocation_reasons,
      signals ( ticker, edge_pct, confidence_score, roi_per_day, time_to_resolution_days, features_json )
    `)
    .eq("id", Number(id))
    .eq("user_id", userId)
    .single();

  if (!data) return null;

  const row = data as any;
  const s = row.signals;
  return {
    ticker: s?.ticker ?? "",
    verdict: row.verdict,
    selected: row.selected ?? false,
    edge_pct: s?.edge_pct ?? 0,
    confidence_score: s?.confidence_score ?? 0,
    roi_per_day: s?.roi_per_day ?? 0,
    time_to_resolution_days: s?.time_to_resolution_days ?? 0,
    suggested_size: row.suggested_size,
    selection_score: row.selection_score ?? null,
    guard_results: row.guard_results ?? [],
    allocation_reasons: row.allocation_reasons ?? [],
    features_json: s?.features_json ?? {},
  } as DecisionReasons;
}

async function getAutomationState(supabase: SB, userId: string): Promise<AutomationState> {
  const { data } = await supabase
    .from("automation_state")
    .select("*")
    .eq("user_id", userId)
    .limit(1)
    .single();

  if (data) return data as AutomationState;

  // No row exists yet — create one in "paused" state for this user
  const now = new Date().toISOString();
  const { data: created } = await supabase
    .from("automation_state")
    .insert({
      user_id: userId,
      status: "paused",
      kill_switch: false,
      daily_loss_dollars: 0,
      max_drawdown_dollars: 0,
      peak_portfolio_value: 0,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (created) return created as AutomationState;

  // Fallback if insert also fails
  return {
    id: 0,
    status: "paused",
    kill_switch: false,
    daily_loss_dollars: 0,
    max_drawdown_dollars: 0,
    peak_portfolio_value: 0,
  } as AutomationState;
}
