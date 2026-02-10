"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type {
  BacktestResult,
  BacktestDataRange,
  BacktestEquityPoint,
} from "@/types/api";
import { fetchBacktestDataRange, runBacktest } from "@/lib/api";

const CATEGORY_COLORS: Record<string, string> = {
  politics: "#3b82f6",
  economics: "#f59e0b",
  crypto: "#a855f7",
  sports: "#22c55e",
  entertainment: "#ec4899",
  science_tech: "#06b6d4",
  weather: "#f97316",
  other: "#6b7280",
};

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-[#1a1d21] bg-[#0d0f11] p-4">
      <p className="text-xs text-[#9ca3af]">{label}</p>
      <p
        className="mt-1 text-xl font-semibold"
        style={{ color: color ?? "#e8e9ea" }}
      >
        {value}
      </p>
    </div>
  );
}

export default function BacktestPanel() {
  const [dataRange, setDataRange] = useState<BacktestDataRange | null>(null);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minEdge, setMinEdge] = useState("1.0");
  const [maxPosition, setMaxPosition] = useState("25");
  const [maxExposure, setMaxExposure] = useState("500");
  const [minSimilarity, setMinSimilarity] = useState("0.70");

  useEffect(() => {
    fetchBacktestDataRange()
      .then((range) => {
        setDataRange(range);
        if (range.earliest && range.latest) {
          setStartDate(range.earliest);
          setEndDate(range.latest);
        }
      })
      .catch(() => {});
  }, []);

  async function handleRun() {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await runBacktest({
        start_date: startDate,
        end_date: endDate,
        pipeline_overrides: {
          min_edge_pct: parseFloat(minEdge),
          max_position_dollars: parseFloat(maxPosition),
        },
        portfolio_overrides: {
          max_total_exposure_dollars: parseFloat(maxExposure),
        },
        matching_overrides: {
          min_similarity: parseFloat(minSimilarity),
        },
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backtest failed");
    } finally {
      setLoading(false);
    }
  }

  // Compute cumulative P&L for the equity curve
  const equityCurve: { ts: string; date: string; pnl: number }[] = [];
  if (result) {
    for (const pt of result.equity_curve) {
      equityCurve.push({
        ts: pt.ts,
        date: pt.ts.substring(0, 10),
        pnl: pt.realized_pnl,
      });
    }
  }

  const categoryData = result
    ? Object.entries(result.by_category)
        .map(([cat, d]) => ({ category: cat, pnl: d.pnl, trades: d.trades }))
        .sort((a, b) => b.pnl - a.pnl)
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Backtesting Engine</h2>
          <p className="text-xs text-[#9ca3af]">
            Replay historical data through the pipeline to evaluate strategy performance
          </p>
        </div>
        {dataRange && dataRange.earliest && (
          <div className="text-right text-xs text-[#9ca3af]">
            <p>
              Data: {dataRange.earliest} to {dataRange.latest}
            </p>
            <p>
              {dataRange.total_runs} pipeline runs, {dataRange.total_snapshots.toLocaleString()} snapshots
            </p>
          </div>
        )}
      </div>

      {/* Config Panel */}
      <div className="rounded-lg border border-[#1a1d21] bg-[#0d0f11] p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <div>
            <label className="mb-1 block text-xs text-[#9ca3af]">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded border border-[#1a1d21] bg-[#050608] px-2 py-1.5 text-xs text-[#e8e9ea]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#9ca3af]">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded border border-[#1a1d21] bg-[#050608] px-2 py-1.5 text-xs text-[#e8e9ea]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#9ca3af]">Min Edge %</label>
            <input
              type="number"
              step="0.1"
              value={minEdge}
              onChange={(e) => setMinEdge(e.target.value)}
              className="w-full rounded border border-[#1a1d21] bg-[#050608] px-2 py-1.5 text-xs text-[#e8e9ea]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#9ca3af]">Max Position $</label>
            <input
              type="number"
              step="5"
              value={maxPosition}
              onChange={(e) => setMaxPosition(e.target.value)}
              className="w-full rounded border border-[#1a1d21] bg-[#050608] px-2 py-1.5 text-xs text-[#e8e9ea]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#9ca3af]">Max Exposure $</label>
            <input
              type="number"
              step="50"
              value={maxExposure}
              onChange={(e) => setMaxExposure(e.target.value)}
              className="w-full rounded border border-[#1a1d21] bg-[#050608] px-2 py-1.5 text-xs text-[#e8e9ea]"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleRun}
              disabled={loading || !startDate || !endDate}
              className="w-full rounded bg-[#3b82f6] px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#2563eb] disabled:opacity-40"
            >
              {loading ? "Running..." : "Run Backtest"}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="rounded-lg border border-[#1a1d21] bg-[#0d0f11] p-12 text-center">
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-[#3b82f6] border-t-transparent" />
          <p className="text-sm text-[#9ca3af]">
            Replaying historical data through the pipeline...
          </p>
          <p className="mt-1 text-xs text-[#6b7280]">
            This may take a minute depending on date range
          </p>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <>
          {/* Summary Cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total P&L"
              value={`$${result.total_pnl >= 0 ? "+" : ""}${result.total_pnl.toFixed(2)}`}
              color={result.total_pnl >= 0 ? "#22c55e" : "#ef4444"}
            />
            <StatCard
              label="Win Rate"
              value={`${(result.win_rate * 100).toFixed(1)}%`}
              color={result.win_rate >= 0.5 ? "#22c55e" : "#f59e0b"}
            />
            <StatCard
              label="Max Drawdown"
              value={`$${result.max_drawdown.toFixed(2)}`}
              color="#ef4444"
            />
            <StatCard
              label="Total Trades"
              value={`${result.total_trades}`}
            />
          </div>

          {/* Secondary stats */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Signals Found" value={`${result.total_signals}`} />
            <StatCard label="Passed Guard" value={`${result.total_passed}`} />
            <StatCard label="Rejected" value={`${result.total_rejected}`} />
            <StatCard
              label="Avg Trade P&L"
              value={`$${result.avg_trade_pnl >= 0 ? "+" : ""}${result.avg_trade_pnl.toFixed(4)}`}
              color={result.avg_trade_pnl >= 0 ? "#22c55e" : "#ef4444"}
            />
            <StatCard
              label="Duration"
              value={`${(result.duration_ms / 1000).toFixed(1)}s`}
            />
          </div>

          {/* Equity Curve */}
          {equityCurve.length > 1 && (
            <div className="rounded-lg border border-[#1a1d21] bg-[#0d0f11] p-4">
              <h3 className="mb-4 text-sm font-medium text-[#e8e9ea]">
                Cumulative P&L
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={equityCurve}>
                  <defs>
                    <linearGradient id="bt-pnl-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={result.total_pnl >= 0 ? "#22c55e" : "#ef4444"}
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor={result.total_pnl >= 0 ? "#22c55e" : "#ef4444"}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1d21" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#6b7280", fontSize: 10 }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#6b7280", fontSize: 10 }}
                    tickLine={false}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0d0f11",
                      border: "1px solid #1a1d21",
                      borderRadius: 6,
                      fontSize: 11,
                    }}
                    formatter={(value) => [
                      `$${Number(value ?? 0).toFixed(4)}`,
                      "P&L",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="pnl"
                    stroke={result.total_pnl >= 0 ? "#22c55e" : "#ef4444"}
                    fill="url(#bt-pnl-grad)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Category Breakdown */}
          {categoryData.length > 0 && (
            <div className="rounded-lg border border-[#1a1d21] bg-[#0d0f11] p-4">
              <h3 className="mb-4 text-sm font-medium text-[#e8e9ea]">
                P&L by Category
              </h3>
              <ResponsiveContainer width="100%" height={Math.max(160, categoryData.length * 36)}>
                <BarChart data={categoryData} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1d21" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: "#6b7280", fontSize: 10 }}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    width={75}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0d0f11",
                      border: "1px solid #1a1d21",
                      borderRadius: 6,
                      fontSize: 11,
                    }}
                    formatter={(value, name) => [
                      name === "pnl" ? `$${Number(value ?? 0).toFixed(4)}` : value,
                      name === "pnl" ? "P&L" : "Trades",
                    ]}
                  />
                  <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                    {categoryData.map((entry) => (
                      <Cell
                        key={entry.category}
                        fill={CATEGORY_COLORS[entry.category] ?? "#6b7280"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Trade Log */}
          {result.trades.length > 0 && (
            <div className="rounded-lg border border-[#1a1d21] bg-[#0d0f11] p-4">
              <h3 className="mb-3 text-sm font-medium text-[#e8e9ea]">
                Trade Log ({result.trades.length} trades)
              </h3>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[#0d0f11] text-[#9ca3af]">
                    <tr>
                      <th className="pb-2 text-left font-medium">Date</th>
                      <th className="pb-2 text-left font-medium">Ticker</th>
                      <th className="pb-2 text-left font-medium">Venue</th>
                      <th className="pb-2 text-left font-medium">Side</th>
                      <th className="pb-2 text-right font-medium">Price</th>
                      <th className="pb-2 text-right font-medium">Size</th>
                      <th className="pb-2 text-right font-medium">Edge %</th>
                    </tr>
                  </thead>
                  <tbody className="text-[#c0c5cb]">
                    {result.trades.slice(0, 100).map((t, i) => (
                      <tr key={i} className="border-t border-[#1a1d21]/50">
                        <td className="py-1.5">{t.ts.substring(0, 10)}</td>
                        <td className="py-1.5 font-mono">{t.ticker.substring(0, 20)}</td>
                        <td className="py-1.5">{t.venue}</td>
                        <td className="py-1.5">{t.side}</td>
                        <td className="py-1.5 text-right">${t.price.toFixed(4)}</td>
                        <td className="py-1.5 text-right">${t.size_dollars.toFixed(2)}</td>
                        <td className="py-1.5 text-right">{t.edge_pct.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.trades.length > 100 && (
                  <p className="mt-2 text-center text-xs text-[#6b7280]">
                    Showing first 100 of {result.trades.length} trades
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Closed Positions */}
          {result.closed_positions.length > 0 && (
            <div className="rounded-lg border border-[#1a1d21] bg-[#0d0f11] p-4">
              <h3 className="mb-3 text-sm font-medium text-[#e8e9ea]">
                Settled Positions ({result.closed_positions.length})
              </h3>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[#0d0f11] text-[#9ca3af]">
                    <tr>
                      <th className="pb-2 text-left font-medium">Ticker</th>
                      <th className="pb-2 text-left font-medium">Venue</th>
                      <th className="pb-2 text-left font-medium">Side</th>
                      <th className="pb-2 text-right font-medium">Entry</th>
                      <th className="pb-2 text-right font-medium">Size</th>
                      <th className="pb-2 text-right font-medium">P&L</th>
                      <th className="pb-2 text-left font-medium">Category</th>
                    </tr>
                  </thead>
                  <tbody className="text-[#c0c5cb]">
                    {result.closed_positions.map((c, i) => (
                      <tr key={i} className="border-t border-[#1a1d21]/50">
                        <td className="py-1.5 font-mono">{c.ticker.substring(0, 20)}</td>
                        <td className="py-1.5">{c.venue}</td>
                        <td className="py-1.5">{c.side}</td>
                        <td className="py-1.5 text-right">${c.entry_price.toFixed(4)}</td>
                        <td className="py-1.5 text-right">${c.size_dollars.toFixed(2)}</td>
                        <td
                          className="py-1.5 text-right font-medium"
                          style={{ color: c.realized_pnl >= 0 ? "#22c55e" : "#ef4444" }}
                        >
                          ${c.realized_pnl >= 0 ? "+" : ""}{c.realized_pnl.toFixed(4)}
                        </td>
                        <td className="py-1.5">
                          <span
                            className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                            style={{
                              backgroundColor: `${CATEGORY_COLORS[c.category] ?? "#6b7280"}20`,
                              color: CATEGORY_COLORS[c.category] ?? "#6b7280",
                            }}
                          >
                            {c.category}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Config Used */}
          <div className="rounded-lg border border-[#1a1d21] bg-[#0d0f11] p-4">
            <h3 className="mb-2 text-sm font-medium text-[#e8e9ea]">
              Configuration Used
            </h3>
            <pre className="overflow-x-auto text-[10px] text-[#6b7280]">
              {JSON.stringify(result.config_snapshot, null, 2)}
            </pre>
          </div>
        </>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <div className="rounded-lg border border-[#1a1d21] bg-[#0d0f11] p-12 text-center">
          <p className="text-sm text-[#9ca3af]">
            Configure parameters above and click &quot;Run Backtest&quot; to replay
            historical data through the pipeline.
          </p>
        </div>
      )}
    </div>
  );
}
