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

function venueBadge(venue: string) {
  const isKalshi = venue === "kalshi";
  const label = venue === "polymarket_us" ? "POLY US" : venue.toUpperCase();
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
  const isEmpty = positions.length === 0;

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

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-text-secondary">
              <th className="px-5 py-3 font-medium">Ticker</th>
              <th className="px-5 py-3 font-medium">Venue</th>
              <th className="px-5 py-3 font-medium">Side</th>
              <th className="px-5 py-3 font-medium text-right">Entry</th>
              <th className="px-5 py-3 font-medium text-right">Size</th>
              <th className="px-5 py-3 font-medium text-right">
                {isOpen ? "Unreal. P&L" : "Real. P&L"}
              </th>
              {isOpen && (
                <th className="px-5 py-3 font-medium text-right">Opened</th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-t border-border">
                  {Array.from({ length: isOpen ? 7 : 6 }).map((_, j) => (
                    <td key={j} className="px-5 py-3">
                      <div className="h-4 w-16 skeleton" />
                    </td>
                  ))}
                </tr>
              ))
            ) : isEmpty ? (
              <tr>
                <td colSpan={isOpen ? 7 : 6} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mb-3 h-10 w-10 text-[#2a2d31]">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                    </svg>
                    <p className="font-mono text-sm text-text-secondary">No {tab} positions</p>
                    <p className="mt-1 text-xs text-[#3b3f46]">
                      {isOpen
                        ? "Positions will appear here when the bot opens trades."
                        : "Closed positions will be shown here."}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              positions.map((p) => {
                const pnl = isOpen ? p.unrealized_pnl : p.realized_pnl;
                return (
                  <tr key={p.id} className="border-t border-border transition-colors hover:bg-white/[0.02]">
                    <td className="px-5 py-3 font-mono text-xs">{p.ticker}</td>
                    <td className="px-5 py-3">{venueBadge(p.venue)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.side === "buy_yes"
                          ? "bg-neon-green/10 text-neon-green"
                          : "bg-neon-red/10 text-neon-red"
                      }`}>
                        {p.side === "buy_yes" ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono">
                      ${fmt(p.entry_price, 4)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono">
                      ${fmt(p.size_dollars)}
                    </td>
                    <td className={`px-5 py-3 text-right font-mono ${pnlColor(pnl)}`}>
                      {pnl >= 0 ? "+" : ""}${fmt(pnl)}
                    </td>
                    {isOpen && (
                      <td className="px-5 py-3 text-right text-xs text-[#6b7280]">
                        {timeAgo(p.opened_at)}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
