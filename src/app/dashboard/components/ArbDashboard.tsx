"use client";

import { useEffect, useState, useCallback } from "react";
import type { ArbSignal } from "@/types/api";
import { fetchArbSignals } from "@/lib/api";

const EDGE_THRESHOLD = 0.02; // 2%

function edgeColor(edge: number): string {
  if (edge >= EDGE_THRESHOLD) return "text-emerald-400";
  if (edge > 0.005) return "text-amber-400";
  return "text-[#9ca3af]";
}

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(2)}%`;
}

function fmtPrice(v: number): string {
  return `$${v.toFixed(2)}`;
}

function fmtTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ArbDashboard({
  refreshKey,
}: {
  refreshKey: number;
}) {
  const [signals, setSignals] = useState<ArbSignal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await fetchArbSignals(50, 0);
      setSignals(data);
    } catch {
      // backend may not be running
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // Summary stats
  const activeMappings = new Set(signals.map((s) => s.mapping_id)).size;
  const aboveThreshold = signals.filter(
    (s) =>
      s.edge_kalshi_to_poly >= EDGE_THRESHOLD ||
      s.edge_poly_to_kalshi >= EDGE_THRESHOLD,
  ).length;
  const bestEdge = signals.reduce(
    (max, s) =>
      Math.max(max, s.edge_kalshi_to_poly, s.edge_poly_to_kalshi),
    0,
  );
  const avgEdge =
    signals.length > 0
      ? signals.reduce(
          (sum, s) =>
            sum +
            Math.max(s.edge_kalshi_to_poly, s.edge_poly_to_kalshi),
          0,
        ) / signals.length
      : 0;

  return (
    <div>
      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
        {[
          { label: "Active Mappings", value: String(activeMappings) },
          { label: "Above Threshold", value: String(aboveThreshold) },
          { label: "Best Edge", value: fmtPct(bestEdge) },
          { label: "Avg Edge", value: fmtPct(avgEdge) },
        ].map((stat) => (
          <div
            key={stat.label}
            className="card-panel rounded-xl px-4 py-3"
          >
            <p className="text-xs text-[#9ca3af]">{stat.label}</p>
            <p className="mt-1 text-lg font-semibold text-[#e8e9ea]">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Signals table */}
      <div className="card-panel rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#1a1d21]">
          <h3 className="text-sm font-medium text-[#e8e9ea]">
            Cross-Platform Arb Signals
          </h3>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-8 animate-pulse rounded bg-[#1a1d21]"
              />
            ))}
          </div>
        ) : signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#9ca3af]">
            <p className="text-sm">No arb signals yet</p>
            <p className="mt-1 text-xs">
              Signals will appear when the arb detector scans matched markets
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1a1d21] text-left text-[#9ca3af]">
                  <th className="px-5 py-3 font-medium">Market</th>
                  <th className="px-3 py-3 font-medium text-right">
                    Kalshi Bid/Ask
                  </th>
                  <th className="px-3 py-3 font-medium text-right">
                    Poly Bid/Ask
                  </th>
                  <th className="px-3 py-3 font-medium text-right">
                    Kalshi Mid
                  </th>
                  <th className="px-3 py-3 font-medium text-right">
                    Poly Mid
                  </th>
                  <th className="px-3 py-3 font-medium text-right">
                    Edge K→P
                  </th>
                  <th className="px-3 py-3 font-medium text-right">
                    Edge P→K
                  </th>
                  <th className="px-3 py-3 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((s) => {
                  const kalshiMid = (s.kalshi_bid + s.kalshi_ask) / 2;
                  const polyMid = (s.poly_bid + s.poly_ask) / 2;

                  return (
                    <tr
                      key={s.id}
                      className="border-b border-[#1a1d21] hover:bg-[#0d0f12] transition-colors"
                    >
                      <td className="px-5 py-3 font-medium text-[#e8e9ea] max-w-[200px] truncate">
                        {s.title || s.kalshi_ticker}
                      </td>
                      <td className="px-3 py-3 text-right text-[#9ca3af]">
                        {fmtPrice(s.kalshi_bid)} / {fmtPrice(s.kalshi_ask)}
                      </td>
                      <td className="px-3 py-3 text-right text-[#9ca3af]">
                        {fmtPrice(s.poly_bid)} / {fmtPrice(s.poly_ask)}
                      </td>
                      <td className="px-3 py-3 text-right text-[#e8e9ea]">
                        {fmtPrice(kalshiMid)}
                      </td>
                      <td className="px-3 py-3 text-right text-[#e8e9ea]">
                        {fmtPrice(polyMid)}
                      </td>
                      <td
                        className={`px-3 py-3 text-right font-medium ${edgeColor(s.edge_kalshi_to_poly)}`}
                      >
                        {fmtPct(s.edge_kalshi_to_poly)}
                      </td>
                      <td
                        className={`px-3 py-3 text-right font-medium ${edgeColor(s.edge_poly_to_kalshi)}`}
                      >
                        {fmtPct(s.edge_poly_to_kalshi)}
                      </td>
                      <td className="px-3 py-3 text-right text-[#9ca3af]">
                        {fmtTime(s.ts)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
