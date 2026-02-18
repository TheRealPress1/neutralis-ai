"use client";

import { useEffect, useState } from "react";
import type { PortfolioStats } from "@/types/api";
import { fetchPortfolioStats } from "@/lib/api";

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const cards: {
  label: string;
  key: keyof PortfolioStats;
  format: (v: number) => string;
  color?: (v: number) => string;
}[] = [
  { label: "Open Positions", key: "open_positions", format: (v) => String(v) },
  { label: "Total Exposure", key: "total_exposure", format: (v) => `$${fmt(v)}` },
  {
    label: "Realized P&L",
    key: "total_realized_pnl",
    format: (v) => (v >= 0 ? `+$${fmt(v)}` : `-$${fmt(Math.abs(v))}`),
    color: (v) => (v >= 0 ? "text-emerald-400" : "text-red-400"),
  },
  {
    label: "Win Rate",
    key: "win_rate",
    format: (v) => `${(v * 100).toFixed(1)}%`,
  },
  { label: "Total Trades", key: "total_trades", format: (v) => String(v) },
];

export default function StatsBar({ refreshKey }: { refreshKey: number }) {
  const [stats, setStats] = useState<PortfolioStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPortfolioStats()
      .then((d) => { if (!cancelled) setStats(d); })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, [refreshKey]);

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <div key={c.key} className="card-panel rounded-xl p-5">
          <p className="font-[family-name:var(--font-cormorant)] text-xs font-medium uppercase tracking-[0.15em] text-[#9ca3af]">
            {c.label}
          </p>
          {stats ? (
            <p
              className={`mt-2 font-mono text-2xl font-bold ${
                c.color ? c.color(stats[c.key] as number) : "text-[#e8e9ea]"
              }`}
            >
              {c.format(stats[c.key] as number)}
            </p>
          ) : (
            <div className="mt-3 h-7 w-20 animate-pulse rounded bg-[#12151a]" />
          )}
        </div>
      ))}
    </div>
  );
}
