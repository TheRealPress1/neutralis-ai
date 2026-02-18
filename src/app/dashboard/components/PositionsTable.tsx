"use client";

import { useEffect, useState } from "react";
import type { Position } from "@/types/api";
import { fetchPositions } from "@/lib/api";

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
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    function load() {
      setLoading(true);
      fetchPositions(tab)
        .then((d) => { if (!cancelled) setPositions(d); })
        .catch(() => { if (!cancelled) setPositions([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }
    load();
    return () => { cancelled = true; };
  }, [refreshKey, tab]);

  const isOpen = tab === "open";

  return (
    <div className="card-panel rounded-xl">
      {/* Header + tabs */}
      <div className="flex items-center justify-between border-b border-[#1a1d21] px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#9ca3af]">
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
              <th className="px-5 py-3 font-medium text-right">Entry</th>
              <th className="px-5 py-3 font-medium text-right">Size</th>
              <th className="px-5 py-3 font-medium text-right">
                {isOpen ? "Unreal. P&L" : "Real. P&L"}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-t border-[#1a1d21]">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-5 py-3">
                      <div className="h-4 w-16 animate-pulse rounded bg-[#0a0d10]" />
                    </td>
                  ))}
                </tr>
              ))
            ) : positions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-[#9ca3af]">
                  No {tab} positions
                </td>
              </tr>
            ) : (
              positions.map((p) => (
                <tr key={p.id} className="border-t border-[#1a1d21]">
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
                    className={`px-5 py-3 text-right font-mono ${pnlColor(
                      isOpen ? p.unrealized_pnl : p.realized_pnl,
                    )}`}
                  >
                    {isOpen
                      ? `$${fmt(p.unrealized_pnl)}`
                      : `$${fmt(p.realized_pnl)}`}
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
