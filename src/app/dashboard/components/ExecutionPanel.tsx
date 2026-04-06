"use client";

import { useEffect, useState } from "react";
import type { ExecutionStats } from "@/types/api";
import { fetchExecutionStats } from "@/lib/api";
import OrdersTable from "./OrdersTable";
import FillsTable from "./FillsTable";

function fmt(n: number, d = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-bg-primary px-4 py-3">
      <span className="text-[10px] uppercase tracking-wider text-text-secondary">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export default function ExecutionPanel({ refreshKey }: { refreshKey: number }) {
  const [stats, setStats] = useState<ExecutionStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchExecutionStats()
      .then((d) => { if (!cancelled) setStats(d); })
      .catch(() => { if (!cancelled) setStats(null); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <StatCard label="Total Orders" value={stats ? String(stats.total_orders) : "-"} />
        <StatCard label="Filled" value={stats ? String(stats.filled) : "-"} />
        <StatCard label="Partial" value={stats ? String(stats.partial) : "-"} />
        <StatCard label="Cancelled" value={stats ? String(stats.cancelled) : "-"} />
        <StatCard label="Avg Slippage" value={stats ? `${fmt(stats.avg_slippage_bps, 1)} bps` : "-"} />
        <StatCard label="Total Fees" value={stats ? `$${fmt(stats.total_fees, 4)}` : "-"} />
      </div>

      {/* Orders */}
      <OrdersTable refreshKey={refreshKey} />

      {/* Recent fills */}
      <FillsTable refreshKey={refreshKey} />
    </div>
  );
}
