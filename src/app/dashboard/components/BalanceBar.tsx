"use client";

import { useEffect, useState } from "react";
import { fetchBalances, type ExchangeBalances } from "@/app/actions/api-keys";

function fmt(n: number) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function BalanceBar({
  refreshKey,
  onNavigate,
}: {
  refreshKey: number;
  onNavigate?: (tab: "dashboard" | "live" | "activity" | "markets" | "connections" | "settings") => void;
}) {
  const [balances, setBalances] = useState<ExchangeBalances | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchBalances()
      .then((b) => {
        if (!cancelled) setBalances(b);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* Kalshi */}
      <div className="hud-panel p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neon-blue/10 ring-1 ring-neon-blue/20">
            <span className="text-sm font-bold text-neon-blue">K</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-text-secondary">
              Kalshi Balance
            </p>
          </div>
        </div>
        {loading ? (
          <div className="mt-3 h-7 w-24 skeleton" />
        ) : balances?.kalshi ? (
          <div className="mt-3">
            <p className="font-mono text-3xl font-bold tabular-nums text-text-primary">
              ${fmt(balances.kalshi.balance)}
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              Portfolio value:{" "}
              <span className="font-mono text-text-mono">
                ${fmt(balances.kalshi.portfolio_value)}
              </span>
            </p>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-sm text-text-secondary">Not connected</p>
            {onNavigate && (
              <button
                onClick={() => onNavigate("connections")}
                className="mt-1 text-xs text-neon-blue transition-colors hover:text-neon-green"
              >
                Connect Kalshi
              </button>
            )}
          </div>
        )}
      </div>

      {/* Polymarket US */}
      <div className="hud-panel p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neon-purple/10 ring-1 ring-neon-purple/20">
            <span className="text-sm font-bold text-neon-purple">P</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-text-secondary">
              Polymarket US
            </p>
          </div>
        </div>
        {loading ? (
          <div className="mt-3 h-7 w-24 skeleton" />
        ) : balances?.polymarket_us ? (
          <div className="mt-3">
            <p className="font-mono text-3xl font-bold tabular-nums text-text-primary">
              ${fmt(balances.polymarket_us.balance)}
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              Buying power:{" "}
              <span className="font-mono text-text-mono">
                ${fmt(balances.polymarket_us.buying_power)}
              </span>
              {balances.polymarket_us.asset_value > 0 && (
                <>
                  {" "}&middot; Positions:{" "}
                  <span className="font-mono text-text-mono">
                    ${fmt(balances.polymarket_us.asset_value)}
                  </span>
                </>
              )}
            </p>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-sm text-text-secondary">Not connected</p>
            {onNavigate && (
              <button
                onClick={() => onNavigate("connections")}
                className="mt-1 text-xs text-neon-blue transition-colors hover:text-neon-green"
              >
                Connect Polymarket US
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
