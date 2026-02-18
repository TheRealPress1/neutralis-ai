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
  PieChart,
  Pie,
} from "recharts";
import type {
  AnalyticsSummary,
  CategoryBreakdown,
  DailyPnL,
  GuardStat,
  PnLBucket,
  VenueBreakdown,
} from "@/types/api";
import {
  fetchAnalyticsSummary,
  fetchPnLTimeline,
  fetchBreakdown,
  fetchGuardStats,
} from "@/lib/api";

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

const VENUE_COLORS = ["#3b82f6", "#a855f7", "#22c55e", "#f59e0b"];

function fmt(n: number | null | undefined): string {
  if (n == null) return "$0.00";
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "0%";
  return `${(n * 100).toFixed(1)}%`;
}

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
      <p className="text-xs font-medium text-[#9ca3af]">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${color ?? "text-[#e8e9ea]"}`}>
        {value}
      </p>
    </div>
  );
}

export default function PerformanceAnalytics({
  refreshKey,
}: {
  refreshKey: number;
}) {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [timeline, setTimeline] = useState<DailyPnL[]>([]);
  const [categories, setCategories] = useState<CategoryBreakdown[]>([]);
  const [venues, setVenues] = useState<VenueBreakdown[]>([]);
  const [distribution, setDistribution] = useState<PnLBucket[]>([]);
  const [guards, setGuards] = useState<GuardStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    function load() {
      setLoading(true);

      Promise.all([
        fetchAnalyticsSummary(),
        fetchPnLTimeline(90),
        fetchBreakdown(),
        fetchGuardStats(),
      ])
        .then(([sum, tl, bd, gs]) => {
          if (cancelled) return;
          setSummary(sum);
          setTimeline(tl);
          setCategories(bd.by_category);
          setVenues(bd.by_venue);
          setDistribution(bd.pnl_distribution);
          setGuards(gs);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }
    load();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // Compute cumulative P&L from daily data
  const cumulativeData = timeline.reduce<
    { date: string; pnl: number; cumPnl: number }[]
  >((acc, day) => {
    const prev = acc.length > 0 ? acc[acc.length - 1].cumPnl : 0;
    acc.push({ date: day.date, pnl: day.pnl, cumPnl: prev + day.pnl });
    return acc;
  }, []);

  const totalPnl = summary?.total_pnl ?? 0;
  const pnlColor = totalPnl >= 0 ? "text-emerald-400" : "text-red-400";

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center text-[#9ca3af]">
        Loading analytics...
      </div>
    );
  }

  if (!summary || summary.total_closed === 0) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-2 text-[#9ca3af]">
        <p className="text-lg font-medium">No closed positions yet</p>
        <p className="text-sm">
          Analytics will appear once positions are closed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Performance Analytics</h2>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total P&L" value={fmt(totalPnl)} color={pnlColor} />
        <StatCard
          label="Closed Trades"
          value={String(summary.total_closed)}
        />
        <StatCard
          label="Avg Trade P&L"
          value={fmt(summary.avg_trade_pnl)}
          color={
            summary.avg_trade_pnl >= 0
              ? "text-emerald-400"
              : "text-red-400"
          }
        />
        <StatCard
          label="Max Drawdown"
          value={fmt(summary.max_drawdown)}
          color="text-red-400"
        />
      </div>

      {/* Cumulative P&L chart */}
      <div className="rounded-lg border border-[#1a1d21] bg-[#0d0f11] p-4">
        <h3 className="mb-4 text-sm font-medium text-[#9ca3af]">
          Cumulative P&L
        </h3>
        {cumulativeData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={cumulativeData}>
              <defs>
                <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={totalPnl >= 0 ? "#10b981" : "#ef4444"}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={totalPnl >= 0 ? "#10b981" : "#ef4444"}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1d21" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#6b7280", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#1a1d21" }}
              />
              <YAxis
                tick={{ fill: "#6b7280", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#1a1d21" }}
                tickFormatter={(v: number) => `$${v}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0d0f11",
                  border: "1px solid #1a1d21",
                  borderRadius: 8,
                  color: "#e8e9ea",
                  fontSize: 12,
                }}
                formatter={(value, name) => [
                  fmt(Number(value ?? 0)),
                  name === "cumPnl" ? "Cumulative" : "Daily",
                ]}
              />
              <Area
                type="monotone"
                dataKey="cumPnl"
                stroke={totalPnl >= 0 ? "#10b981" : "#ef4444"}
                fill="url(#pnlGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-8 text-center text-sm text-[#6b7280]">
            No timeline data yet
          </p>
        )}
      </div>

      {/* Category breakdown + Distribution */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Category P&L */}
        <div className="rounded-lg border border-[#1a1d21] bg-[#0d0f11] p-4">
          <h3 className="mb-4 text-sm font-medium text-[#9ca3af]">
            P&L by Category
          </h3>
          {categories.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={categories} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1d21" />
                <XAxis
                  type="number"
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "#1a1d21" }}
                  tickFormatter={(v: number) => `$${v}`}
                />
                <YAxis
                  type="category"
                  dataKey="category"
                  width={90}
                  tick={{ fill: "#9ca3af", fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "#1a1d21" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0d0f11",
                    border: "1px solid #1a1d21",
                    borderRadius: 8,
                    color: "#e8e9ea",
                    fontSize: 12,
                  }}
                  formatter={(value) => [fmt(Number(value ?? 0)), "P&L"]}
                />
                <Bar dataKey="total_pnl" radius={[0, 4, 4, 0]}>
                  {categories.map((c) => (
                    <Cell
                      key={c.category}
                      fill={CATEGORY_COLORS[c.category] ?? "#6b7280"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-sm text-[#6b7280]">
              No category data
            </p>
          )}
        </div>

        {/* P&L Distribution */}
        <div className="rounded-lg border border-[#1a1d21] bg-[#0d0f11] p-4">
          <h3 className="mb-4 text-sm font-medium text-[#9ca3af]">
            P&L Distribution
          </h3>
          {distribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1d21" />
                <XAxis
                  dataKey="bucket_start"
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "#1a1d21" }}
                  tickFormatter={(v: number) => `$${v}`}
                />
                <YAxis
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "#1a1d21" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0d0f11",
                    border: "1px solid #1a1d21",
                    borderRadius: 8,
                    color: "#e8e9ea",
                    fontSize: 12,
                  }}
                  formatter={(value) => [Number(value ?? 0), "Trades"]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {distribution.map((d) => (
                    <Cell
                      key={d.bucket_start}
                      fill={d.bucket_start >= 0 ? "#10b981" : "#ef4444"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-sm text-[#6b7280]">
              No distribution data
            </p>
          )}
        </div>
      </div>

      {/* Venue breakdown + Guard effectiveness */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Venue breakdown */}
        <div className="rounded-lg border border-[#1a1d21] bg-[#0d0f11] p-4">
          <h3 className="mb-4 text-sm font-medium text-[#9ca3af]">
            P&L by Venue
          </h3>
          {venues.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie
                    data={venues}
                    dataKey="total_trades"
                    nameKey="venue"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    strokeWidth={0}
                  >
                    {venues.map((_, i) => (
                      <Cell
                        key={i}
                        fill={VENUE_COLORS[i % VENUE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0d0f11",
                      border: "1px solid #1a1d21",
                      borderRadius: 8,
                      color: "#e8e9ea",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {venues.map((v, i) => (
                  <div key={v.venue} className="flex items-center gap-2 text-sm">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{
                        backgroundColor:
                          VENUE_COLORS[i % VENUE_COLORS.length],
                      }}
                    />
                    <span className="text-[#9ca3af] capitalize">
                      {v.venue}
                    </span>
                    <span className="ml-auto font-medium">
                      {v.total_trades} trades
                    </span>
                    <span
                      className={
                        v.total_pnl >= 0 ? "text-emerald-400" : "text-red-400"
                      }
                    >
                      {fmt(v.total_pnl)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-[#6b7280]">
              No venue data
            </p>
          )}
        </div>

        {/* Guard effectiveness */}
        <div className="rounded-lg border border-[#1a1d21] bg-[#0d0f11] p-4">
          <h3 className="mb-4 text-sm font-medium text-[#9ca3af]">
            Guard Effectiveness
          </h3>
          {guards.length > 0 ? (
            <div className="space-y-3">
              {guards.map((g) => (
                <div key={g.guard_name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#c0c5cb] font-mono text-xs">
                      {g.guard_name}
                    </span>
                    <span className="text-[#9ca3af]">
                      {g.rejections}/{g.total_evaluations} rejected (
                      {fmtPct(g.rejection_rate)})
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[#1a1d21]">
                    <div
                      className="h-2 rounded-full bg-red-500/70"
                      style={{
                        width: `${Math.min(g.rejection_rate * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-[#6b7280]">
              No guard data
            </p>
          )}
        </div>
      </div>

      {/* Performance detail stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Best Day" value={fmt(summary.best_day)} color="text-emerald-400" />
        <StatCard label="Worst Day" value={fmt(summary.worst_day)} color="text-red-400" />
        <StatCard
          label="Win Rate"
          value={fmtPct(
            summary.total_closed > 0
              ? (summary.total_closed -
                  (timeline.reduce((s, d) => s + (d.losses ?? 0), 0) || 0)) /
                  summary.total_closed
              : 0
          )}
        />
        <StatCard
          label="Avg Win"
          value={fmt(summary.avg_win)}
          color="text-emerald-400"
        />
        <StatCard
          label="Avg Loss"
          value={`-$${Math.abs(summary.avg_loss).toFixed(2)}`}
          color="text-red-400"
        />
        <StatCard
          label="Profit Factor"
          value={
            summary.avg_loss > 0
              ? (summary.avg_win / summary.avg_loss).toFixed(2)
              : "N/A"
          }
        />
      </div>
    </div>
  );
}
