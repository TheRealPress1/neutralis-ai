"use client";

import { useEffect, useState } from "react";
import type { Position } from "@/types/api";
import { fetchPositions } from "@/lib/api";
import { fetchLivePositions, type ExchangePosition } from "@/app/actions/api-keys";

function fmt(n: number, d = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function pnlColor(v: number) {
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-red-400";
  return "text-[#9ca3af]";
}

export default function PositionsTable({ refreshKey }: { refreshKey: number }) {
  const [tab, setTab] = useState<"open" | "closed">("open");
  const [livePositions, setLivePositions] = useState<ExchangePosition[]>([]);
  const [closedPositions, setClosedPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        if (tab === "open") {
          const live = await fetchLivePositions();
          if (!cancelled) {
            setLivePositions([...live.kalshi, ...live.polymarket]);
          }
        } else {
          const closed = await fetchPositions("closed");
          if (!cancelled) setClosedPositions(closed);
        }
      } catch {
        if (!cancelled) {
          if (tab === "open") setLivePositions([]);
          else setClosedPositions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [refreshKey, tab]);

  const isOpen = tab === "open";
  const isEmpty = isOpen ? livePositions.length === 0 : closedPositions.length === 0;

  return (
    <div className="card-panel rounded-xl">
      {/* Header + tabs */}
      <div className="flex items-center justify-between border-b border-[#1a1d21] px-5 py-4">
        <h2 className="font-[family-name:var(--font-cormorant)] text-base font-medium tracking-wide text-[#9ca3af]">
          Positions
        </h2>
        <div className="flex gap-1">
          {(["open", "closed"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                tab === t
                  ? "bg-[#1a1d21] text-[#e8e9ea]"
                  : "text-[#9ca3af] hover:text-[#e8e9ea]"
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
            <tr className="text-xs uppercase tracking-wider text-[#9ca3af]">
              <th className="px-5 py-3 font-medium">Ticker</th>
              <th className="px-5 py-3 font-medium">Venue</th>
              <th className="px-5 py-3 font-medium">Side</th>
              <th className="px-5 py-3 font-medium text-right">{isOpen ? "Avg Price" : "Entry"}</th>
              <th className="px-5 py-3 font-medium text-right">{isOpen ? "Qty" : "Size"}</th>
              <th className="px-5 py-3 font-medium text-right">
                {isOpen ? "Value" : "Real. P&L"}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-t border-[#1a1d21]">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-5 py-3">
                      <div className="h-4 w-16 animate-pulse rounded bg-[#12151a]" />
                    </td>
                  ))}
                </tr>
              ))
            ) : isEmpty ? (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mb-3 h-10 w-10 text-[#2a2d31]">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                    </svg>
                    <p className="text-sm text-[#9ca3af]">No {tab} positions</p>
                    <p className="mt-1 text-xs text-[#3b3f46]">
                      {tab === "open"
                        ? "Connect your exchange keys to see live positions."
                        : "Closed positions will be shown here."}
                    </p>
                  </div>
                </td>
              </tr>
            ) : isOpen ? (
              livePositions.map((p, i) => (
                <tr key={`${p.venue}-${p.ticker}-${i}`} className="border-t border-[#1a1d21] transition-colors hover:bg-white/[0.02]">
                  <td className="px-5 py-3 font-mono text-xs">{p.ticker}</td>
                  <td className="px-5 py-3">
                    <span className="rounded border border-[#1a1d21] bg-[#0a0d10] px-2 py-0.5 text-xs uppercase">
                      {p.venue}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={p.side === "yes" ? "text-emerald-400" : "text-red-400"}>
                      {p.side.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-mono">
                    ${fmt(p.avg_price, 4)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono">
                    {p.quantity}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-[#e8e9ea]">
                    ${fmt(p.market_value)}
                  </td>
                </tr>
              ))
            ) : (
              closedPositions.map((p) => (
                <tr key={p.id} className="border-t border-[#1a1d21] transition-colors hover:bg-white/[0.02]">
                  <td className="px-5 py-3 font-mono text-xs">{p.ticker}</td>
                  <td className="px-5 py-3">
                    <span className="rounded border border-[#1a1d21] bg-[#0a0d10] px-2 py-0.5 text-xs uppercase">
                      {p.venue}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={
                        p.side === "buy_yes" ? "text-emerald-400" : "text-red-400"
                      }
                    >
                      {p.side === "buy_yes" ? "YES" : "NO"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-mono">
                    ${fmt(p.entry_price, 4)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono">
                    ${fmt(p.size_dollars)}
                  </td>
                  <td
                    className={`px-5 py-3 text-right font-mono ${pnlColor(p.realized_pnl)}`}
                  >
                    ${fmt(p.realized_pnl)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
