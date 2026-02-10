"use client";

import { useEffect, useState } from "react";
import type { Fill } from "@/types/api";
import { fetchFills } from "@/lib/api";

function fmt(n: number, d = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
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

function slippageColor(bps: number) {
  if (bps < 10) return "text-emerald-400";
  if (bps <= 50) return "text-amber-400";
  return "text-red-400";
}

export default function FillsTable({ refreshKey }: { refreshKey: number }) {
  const [fills, setFills] = useState<Fill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchFills(50)
      .then((d) => { if (!cancelled) setFills(d); })
      .catch(() => { if (!cancelled) setFills([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  return (
    <div className="card-panel rounded-xl">
      <div className="border-b border-[#1a1d21] px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#9ca3af]">
          Recent Fills
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-[#9ca3af]">
              <th className="px-5 py-3 font-medium">Ticker</th>
              <th className="px-5 py-3 font-medium">Side</th>
              <th className="px-5 py-3 font-medium text-right">Fill Price</th>
              <th className="px-5 py-3 font-medium text-right">Req Price</th>
              <th className="px-5 py-3 font-medium text-right">Slippage</th>
              <th className="px-5 py-3 font-medium text-right">Qty</th>
              <th className="px-5 py-3 font-medium text-right">Size$</th>
              <th className="px-5 py-3 font-medium text-right">Fee$</th>
              <th className="px-5 py-3 font-medium text-right">Time</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-t border-[#1a1d21]">
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="px-5 py-3">
                      <div className="h-4 w-16 animate-pulse rounded bg-[#0a0d10]" />
                    </td>
                  ))}
                </tr>
              ))
            ) : fills.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-[#9ca3af]">
                  No fills yet
                </td>
              </tr>
            ) : (
              fills.map((f) => (
                <tr key={f.id} className="border-t border-[#1a1d21]">
                  <td className="px-5 py-3 font-mono text-xs">{f.ticker ?? "-"}</td>
                  <td className="px-5 py-3">
                    {f.side ? (
                      <span className={f.side === "buy_yes" ? "text-emerald-400" : "text-red-400"}>
                        {f.side === "buy_yes" ? "YES" : "NO"}
                      </span>
                    ) : "-"}
                  </td>
                  <td className="px-5 py-3 text-right font-mono">${fmt(f.price, 4)}</td>
                  <td className="px-5 py-3 text-right font-mono">
                    {f.requested_price != null ? `$${fmt(f.requested_price, 4)}` : "-"}
                  </td>
                  <td className="px-5 py-3 text-right font-mono">
                    <span className={slippageColor(f.slippage_bps)}>
                      {fmt(f.slippage_bps, 1)} bps
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-mono">{fmt(f.quantity, 2)}</td>
                  <td className="px-5 py-3 text-right font-mono">${fmt(f.size_dollars)}</td>
                  <td className="px-5 py-3 text-right font-mono">${fmt(f.fee_dollars, 4)}</td>
                  <td className="px-5 py-3 text-right text-xs text-[#9ca3af]">
                    {timeAgo(f.created_at)}
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
