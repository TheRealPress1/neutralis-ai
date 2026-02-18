"use client";

import { useEffect, useState } from "react";
import { fetchLivePositions } from "@/app/actions/api-keys";

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface LiveStats {
  open_positions: number;
  total_exposure: number;
  kalshi_positions: number;
  polymarket_positions: number;
}

export default function StatsBar({ refreshKey }: { refreshKey: number }) {
  const [stats, setStats] = useState<LiveStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchLivePositions()
      .then((live) => {
        if (cancelled) return;
        const all = [...live.kalshi, ...live.polymarket];
        setStats({
          open_positions: all.length,
          total_exposure: all.reduce((sum, p) => sum + p.market_value, 0),
          kalshi_positions: live.kalshi.length,
          polymarket_positions: live.polymarket.length,
        });
      })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, [refreshKey]);

  const cards: {
    label: string;
    key: keyof LiveStats;
    format: (v: number) => string;
    color?: (v: number) => string;
  }[] = [
    { label: "Open Positions", key: "open_positions", format: (v) => String(v) },
    { label: "Total Exposure", key: "total_exposure", format: (v) => `$${fmt(v)}` },
    { label: "Kalshi Positions", key: "kalshi_positions", format: (v) => String(v) },
    { label: "Polymarket Positions", key: "polymarket_positions", format: (v) => String(v) },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {cards.map((c) => (
        <div key={c.key} className="card-panel rounded-xl p-5">
          <p className="font-[family-name:var(--font-cormorant)] text-xs font-medium uppercase tracking-[0.15em] text-[#9ca3af]">
            {c.label}
          </p>
          {stats ? (
            <p
              className={`mt-2 font-mono text-2xl font-bold ${
                c.color ? c.color(stats[c.key]) : "text-[#e8e9ea]"
              }`}
            >
              {c.format(stats[c.key])}
            </p>
          ) : (
            <div className="mt-3 h-7 w-20 animate-pulse rounded bg-[#12151a]" />
          )}
        </div>
      ))}
    </div>
  );
}
