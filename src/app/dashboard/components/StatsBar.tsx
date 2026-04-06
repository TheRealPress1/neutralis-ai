"use client";

import { useEffect, useState } from "react";
import { fetchPortfolioStats } from "@/lib/api";
import type { PortfolioStats } from "@/types/api";

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pctFmt(n: number) {
  return (n * 100).toFixed(1) + "%";
}

export default function StatsBar({ refreshKey }: { refreshKey: number }) {
  const [stats, setStats] = useState<PortfolioStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPortfolioStats()
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, [refreshKey]);

  const cards: {
    label: string;
    value: (s: PortfolioStats) => string;
    color?: (s: PortfolioStats) => string;
  }[] = [
    {
      label: "Open Positions",
      value: (s) => String(s.open_positions),
    },
    {
      label: "Total Exposure",
      value: (s) => `$${fmt(s.total_exposure)}`,
    },
    {
      label: "Realized P&L",
      value: (s) => `${s.total_realized_pnl >= 0 ? "+" : ""}$${fmt(s.total_realized_pnl)}`,
      color: (s) =>
        s.total_realized_pnl > 0
          ? "text-neon-green drop-shadow-[0_0_8px_rgba(0,255,170,0.3)]"
          : s.total_realized_pnl < 0
            ? "text-neon-red drop-shadow-[0_0_8px_rgba(255,51,102,0.3)]"
            : "text-text-primary",
    },
    {
      label: "Win Rate",
      value: (s) => s.total_trades > 0 ? pctFmt(s.win_rate) : "--",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {cards.map((c, i) => (
        <div key={i} className="hud-panel p-5">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-text-secondary">
            {c.label}
          </p>
          {stats ? (
            <p
              className={`mt-2 font-mono text-3xl font-bold tabular-nums ${
                c.color ? c.color(stats) : "text-text-primary"
              }`}
            >
              {c.value(stats)}
            </p>
          ) : (
            <div className="mt-3 h-7 w-20 skeleton" />
          )}
        </div>
      ))}
    </div>
  );
}
