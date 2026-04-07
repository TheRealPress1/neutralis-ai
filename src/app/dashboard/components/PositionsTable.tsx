"use client";

import { useEffect, useState } from "react";
import type { Position } from "@/types/api";
import { fetchPositions } from "@/lib/api";

function fmt(n: number, d = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function pnlColor(v: number) {
  if (v > 0) return "text-neon-green";
  if (v < 0) return "text-neon-red";
  return "text-text-secondary";
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Parse raw exchange tickers into readable event names. */
const TEAM_NAMES: Record<string, string> = {
  ARS: "Arsenal", AVL: "Aston Villa", BOU: "Bournemouth", BRE: "Brentford",
  BRI: "Brighton", BUR: "Burnley", CHE: "Chelsea", CRY: "Crystal Palace",
  EVE: "Everton", FUL: "Fulham", LFC: "Liverpool", LIV: "Liverpool",
  MCI: "Man City", MUN: "Man United", NEW: "Newcastle", NFO: "Nott Forest",
  SUN: "Sunderland", TOT: "Tottenham", WHU: "West Ham", WOL: "Wolves",
  NAP: "Napoli", ACM: "AC Milan", INT: "Inter Milan", JUV: "Juventus",
  ATA: "Atalanta", LAZ: "Lazio", ROM: "Roma", FIO: "Fiorentina",
  BOL: "Bologna", CAG: "Cagliari", CRE: "Cremonese", COM: "Como",
  UDI: "Udinese", MIL: "AC Milan",
  SCH: "Schalke", WOB: "Wolfsburg", SGE: "Frankfurt", FRE: "Freiburg",
  BOR: "Dortmund", BAY: "Bayern", MAI: "Mainz",
  HUM: "Humbert", SIN: "Sinner", MED: "Medvedev", BER: "Berrettini",
};

function parseTicker(raw: string): { event: string; outcome: string; date: string } {
  const kalshiMatch = raw.match(/^KX\w+-(\d{2})([A-Z]{3})(\d{2})([A-Z]{3,})([A-Z]{3,})-([A-Z]+)$/);
  if (kalshiMatch) {
    const [, , month, day, team1, team2, outcome] = kalshiMatch;
    const t1 = TEAM_NAMES[team1] ?? team1;
    const t2 = TEAM_NAMES[team2] ?? team2;
    return { event: `${t1} vs ${t2}`, outcome, date: `${month} ${day}` };
  }

  const polyMatch = raw.match(/^(?:atc|aec)-\w+-(\w+)-(\w+)-\d{4}-(\d{2})-(\d{2})-?(\w*)$/);
  if (polyMatch) {
    const [, t1raw, t2raw, mo, day, outcomeRaw] = polyMatch;
    const t1 = TEAM_NAMES[t1raw.toUpperCase()] ?? t1raw.toUpperCase();
    const t2 = TEAM_NAMES[t2raw.toUpperCase()] ?? t2raw.toUpperCase();
    const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return { event: `${t1} vs ${t2}`, outcome: (outcomeRaw || "").toUpperCase(), date: `${months[parseInt(mo)]} ${day}` };
  }

  return { event: raw.length > 30 ? raw.slice(0, 28) + "..." : raw, outcome: "", date: "" };
}

function venueBadge(venue: string) {
  const isKalshi = venue === "kalshi";
  const label = venue === "polymarket_us" ? "POLY US" : venue === "polymarket" ? "POLY" : venue.toUpperCase();
  return (
    <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
      isKalshi
        ? "border-neon-blue/20 bg-neon-blue/5 text-neon-blue"
        : "border-neon-purple/20 bg-neon-purple/5 text-neon-purple"
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${isKalshi ? "bg-neon-blue" : "bg-neon-purple"}`} />
      {label}
    </span>
  );
}

function sideBadge(side: string) {
  const isYes = side === "buy_yes";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
      isYes ? "bg-neon-green/10 text-neon-green" : "bg-neon-red/10 text-neon-red"
    }`}>
      {isYes ? "YES" : "NO"}
    </span>
  );
}

/** A group of positions that belong to the same arb trade (same event_ticker). */
interface ArbTrade {
  eventTicker: string;
  event: string;
  date: string;
  legs: Position[];
  totalSize: number;
  totalPnl: number;
  venues: string[];
  isMultiLeg: boolean;
  openedAt: string;
}

function groupIntoArbTrades(positions: Position[]): ArbTrade[] {
  const groups = new Map<string, Position[]>();
  for (const p of positions) {
    const key = p.event_ticker || p.ticker;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  const trades: ArbTrade[] = [];
  for (const [eventTicker, legs] of groups) {
    const parsed = parseTicker(legs[0].ticker);
    const venues = [...new Set(legs.map((l) => l.venue))];
    const totalSize = legs.reduce((s, l) => s + l.size_dollars, 0);
    const totalPnl = legs.reduce((s, l) => s + (l.unrealized_pnl || l.realized_pnl || 0), 0);
    const earliest = legs.reduce((min, l) => (l.opened_at < min ? l.opened_at : min), legs[0].opened_at);

    trades.push({
      eventTicker,
      event: parsed.event,
      date: parsed.date,
      legs,
      totalSize,
      totalPnl,
      venues,
      isMultiLeg: legs.length > 1 || venues.length > 1,
      openedAt: earliest,
    });
  }

  return trades.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
}

/**
 * Compute payout for each possible outcome of an arb trade.
 *
 * For each leg: if the leg's outcome matches the scenario, the YES side pays $1/contract
 * and the NO side pays $0. If it doesn't match, YES pays $0 and NO pays $1.
 */
interface Scenario {
  label: string;
  payout: number;
  profit: number;
  profitPct: number;
}

function computeScenarios(trade: ArbTrade): Scenario[] {
  // Collect all distinct outcomes from the legs
  const outcomes = new Set<string>();
  const legData: { outcome: string; side: "buy_yes" | "buy_no"; quantity: number }[] = [];

  for (const leg of trade.legs) {
    const parsed = parseTicker(leg.ticker);
    const outcome = parsed.outcome || "UNKNOWN";
    outcomes.add(outcome);
    legData.push({ outcome, side: leg.side, quantity: leg.quantity });
  }

  // For 3-way soccer matches, add "DRAW" if we have exactly 2 team outcomes
  const outcomeArr = [...outcomes];
  if (outcomeArr.length === 2 && trade.event.includes(" vs ")) {
    // Check if this looks like a soccer match (not tennis)
    const hasDraw = outcomeArr.some((o) => o === "DRAW" || o === "TIE");
    if (!hasDraw) {
      outcomes.add("DRAW");
    }
  }

  const scenarios: Scenario[] = [];
  for (const scenario of outcomes) {
    let payout = 0;
    for (const leg of legData) {
      const outcomeMatches = leg.outcome === scenario;
      if (leg.side === "buy_yes") {
        // YES pays $1 if outcome matches, $0 otherwise
        payout += outcomeMatches ? leg.quantity * 1.0 : 0;
      } else {
        // NO pays $1 if outcome does NOT match, $0 if it matches
        payout += outcomeMatches ? 0 : leg.quantity * 1.0;
      }
    }
    const profit = payout - trade.totalSize;
    const profitPct = trade.totalSize > 0 ? (profit / trade.totalSize) * 100 : 0;
    scenarios.push({
      label: TEAM_NAMES[scenario] || scenario,
      payout: Math.round(payout * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      profitPct: Math.round(profitPct * 10) / 10,
    });
  }

  return scenarios.sort((a, b) => b.profit - a.profit);
}

function ScenarioTable({ trade }: { trade: ArbTrade }) {
  const scenarios = computeScenarios(trade);
  if (scenarios.length === 0) return null;

  const allProfit = scenarios.every((s) => s.profit > 0);

  return (
    <div className="border-t border-border/50 bg-white/[0.015] px-5 py-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
          Payout Scenarios
        </span>
        {allProfit && (
          <span className="rounded border border-neon-green/30 bg-neon-green/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-neon-green">
            All outcomes profitable
          </span>
        )}
      </div>
      <div className="grid gap-1.5">
        {scenarios.map((s) => {
          const isProfit = s.profit > 0;
          return (
            <div
              key={s.label}
              className={`flex items-center justify-between rounded px-3 py-2 ${
                isProfit
                  ? "bg-neon-green/[0.04] ring-1 ring-inset ring-neon-green/10"
                  : "bg-neon-red/[0.04] ring-1 ring-inset ring-neon-red/10"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${isProfit ? "text-neon-green" : "text-neon-red"}`}>
                  {isProfit ? "+" : ""}{fmt(s.profit)}
                </span>
                <span className="text-[10px] text-text-secondary">
                  ({isProfit ? "+" : ""}{fmt(s.profitPct, 1)}%)
                </span>
              </div>
              <span className="text-xs text-text-secondary">
                if <span className="font-medium text-text-primary">{s.label}</span> wins
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function tradeTypeBadge(trade: ArbTrade) {
  if (trade.venues.length >= 2) {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-neon-green/20 bg-neon-green/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neon-green">
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
        </svg>
        Cross-Platform Arb
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded border border-neon-amber/20 bg-neon-amber/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neon-amber">
      Directional
    </span>
  );
}

function ArbTradeCard({ trade, isOpen }: { trade: ArbTrade; isOpen: boolean }) {
  const [expanded, setExpanded] = useState(trade.legs.length <= 3);

  return (
    <div className="border-b border-border last:border-b-0">
      {/* Trade header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.02]"
      >
        {/* Expand chevron */}
        <svg
          className={`h-4 w-4 shrink-0 text-text-secondary transition-transform ${expanded ? "rotate-90" : ""}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
        </svg>

        {/* Event name + date */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <span className="truncate text-sm font-medium text-text-primary">{trade.event}</span>
            {trade.date && (
              <span className="shrink-0 text-xs text-text-secondary">{trade.date}</span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            {tradeTypeBadge(trade)}
            <span className="text-[10px] text-text-secondary">
              {trade.legs.length} leg{trade.legs.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Venues */}
        <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
          {trade.venues.map((v) => (
            <span key={v}>{venueBadge(v)}</span>
          ))}
        </div>

        {/* Total size */}
        <div className="shrink-0 text-right">
          <div className="font-mono text-sm text-text-primary">${fmt(trade.totalSize)}</div>
          <div className="text-[10px] text-text-secondary">invested</div>
        </div>

        {/* P&L */}
        <div className="shrink-0 text-right" style={{ minWidth: 72 }}>
          <div className={`font-mono text-sm ${pnlColor(trade.totalPnl)}`}>
            {trade.totalPnl >= 0 ? "+" : ""}${fmt(trade.totalPnl)}
          </div>
          <div className="text-[10px] text-text-secondary">
            {isOpen ? "unreal." : "realized"}
          </div>
        </div>

        {/* Time */}
        {isOpen && (
          <div className="hidden shrink-0 text-right text-xs text-text-secondary sm:block" style={{ minWidth: 56 }}>
            {timeAgo(trade.openedAt)}
          </div>
        )}
      </button>

      {/* Expanded legs */}
      {expanded && (
        <div className="border-t border-border/50 bg-white/[0.01]">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-text-secondary/60">
                <th className="py-2 pl-14 pr-3 font-medium">Venue</th>
                <th className="px-3 py-2 font-medium">Side</th>
                <th className="px-3 py-2 font-medium">Outcome</th>
                <th className="px-3 py-2 text-right font-medium">Entry</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 text-right font-medium">Size</th>
                <th className="px-3 py-2 text-right font-medium">P&L</th>
              </tr>
            </thead>
            <tbody>
              {trade.legs.map((leg) => {
                const parsed = parseTicker(leg.ticker);
                const pnl = isOpen ? leg.unrealized_pnl : leg.realized_pnl;
                return (
                  <tr key={leg.id} className="border-t border-border/30 transition-colors hover:bg-white/[0.02]">
                    <td className="py-2.5 pl-14 pr-3">{venueBadge(leg.venue)}</td>
                    <td className="px-3 py-2.5">{sideBadge(leg.side)}</td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-[11px] font-medium text-neon-amber">
                        {parsed.outcome || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-text-primary">
                      ${fmt(leg.entry_price, 2)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-text-secondary">
                      {fmt(leg.quantity, 1)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-text-primary">
                      ${fmt(leg.size_dollars)}
                    </td>
                    <td className={`px-3 py-2.5 text-right font-mono ${pnlColor(pnl)}`}>
                      {pnl >= 0 ? "+" : ""}${fmt(pnl)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* Payout scenarios for multi-leg arb trades */}
          {trade.isMultiLeg && <ScenarioTable trade={trade} />}
        </div>
      )}
    </div>
  );
}

export default function PositionsTable({ refreshKey }: { refreshKey: number }) {
  const [tab, setTab] = useState<"open" | "closed">("open");
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await fetchPositions(tab);
        if (!cancelled) setPositions(data);
      } catch {
        if (!cancelled) setPositions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [refreshKey, tab]);

  const isOpen = tab === "open";
  const trades = groupIntoArbTrades(positions);
  const isEmpty = trades.length === 0;

  return (
    <div className="hud-panel">
      {/* Header + tabs */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-text-secondary">
          Positions
        </h2>
        <div className="flex gap-1">
          {(["open", "closed"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                tab === t
                  ? "bg-neon-green/10 text-neon-green"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Trade cards */}
      <div>
        {loading ? (
          <div className="space-y-0">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b border-border px-5 py-4">
                <div className="h-4 w-4 skeleton rounded" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 skeleton rounded" />
                  <div className="h-3 w-24 skeleton rounded" />
                </div>
                <div className="h-4 w-16 skeleton rounded" />
                <div className="h-4 w-16 skeleton rounded" />
              </div>
            ))}
          </div>
        ) : isEmpty ? (
          <div className="px-5 py-16 text-center">
            <div className="flex flex-col items-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mb-3 h-10 w-10 text-border">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
              </svg>
              <p className="font-mono text-sm text-text-secondary">No {tab} positions</p>
              <p className="mt-1 text-xs text-border">
                {isOpen
                  ? "Positions will appear here when the bot opens trades."
                  : "Closed positions will be shown here."}
              </p>
            </div>
          </div>
        ) : (
          trades.map((trade) => (
            <ArbTradeCard key={trade.eventTicker} trade={trade} isOpen={isOpen} />
          ))
        )}
      </div>

      {/* Summary footer */}
      {!loading && !isEmpty && (
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <span className="text-xs text-text-secondary">
            {trades.length} trade{trades.length !== 1 ? "s" : ""} · {positions.length} leg{positions.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-4">
            <span className="text-xs text-text-secondary">
              Total: <span className="font-mono text-text-primary">${fmt(trades.reduce((s, t) => s + t.totalSize, 0))}</span>
            </span>
            <span className={`text-xs font-mono ${pnlColor(trades.reduce((s, t) => s + t.totalPnl, 0))}`}>
              {trades.reduce((s, t) => s + t.totalPnl, 0) >= 0 ? "+" : ""}
              ${fmt(trades.reduce((s, t) => s + t.totalPnl, 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
