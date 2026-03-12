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
  onNavigate?: (tab: "dashboard" | "automation" | "activity" | "matches" | "connections" | "settings") => void;
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
      <div className="card-panel rounded-xl p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1a1d21]">
            <span className="text-sm font-bold text-[#e8e9ea]">K</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-[family-name:var(--font-cormorant)] text-xs font-medium uppercase tracking-[0.15em] text-[#9ca3af]">
              Kalshi Balance
            </p>
          </div>
        </div>
        {loading ? (
          <div className="mt-3 h-7 w-24 animate-pulse rounded bg-[#12151a]" />
        ) : balances?.kalshi ? (
          <div className="mt-3">
            <p className="font-mono text-2xl font-bold text-[#e8e9ea]">
              ${fmt(balances.kalshi.balance)}
            </p>
            <p className="mt-1 text-xs text-[#9ca3af]">
              Portfolio value:{" "}
              <span className="font-mono text-[#c0c5cb]">
                ${fmt(balances.kalshi.portfolio_value)}
              </span>
            </p>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-sm text-[#3b3f46]">Not connected</p>
            {onNavigate && (
              <button
                onClick={() => onNavigate("connections")}
                className="mt-1 text-xs text-[#9ca3af] underline underline-offset-2 transition-colors hover:text-[#e8e9ea]"
              >
                Connect Kalshi
              </button>
            )}
          </div>
        )}
      </div>

      {/* Polymarket US */}
      <div className="card-panel rounded-xl p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1a1d21]">
            <span className="text-sm font-bold text-[#e8e9ea]">P</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-[family-name:var(--font-cormorant)] text-xs font-medium uppercase tracking-[0.15em] text-[#9ca3af]">
              Polymarket US
            </p>
          </div>
        </div>
        {loading ? (
          <div className="mt-3 h-7 w-24 animate-pulse rounded bg-[#12151a]" />
        ) : balances?.polymarket_us ? (
          <div className="mt-3">
            <p className="font-mono text-2xl font-bold text-[#e8e9ea]">
              ${fmt(balances.polymarket_us.balance)}
            </p>
            <p className="mt-1 text-xs text-[#9ca3af]">
              Buying power:{" "}
              <span className="font-mono text-[#c0c5cb]">
                ${fmt(balances.polymarket_us.buying_power)}
              </span>
              {balances.polymarket_us.asset_value > 0 && (
                <>
                  {" "}&middot; Positions:{" "}
                  <span className="font-mono text-[#c0c5cb]">
                    ${fmt(balances.polymarket_us.asset_value)}
                  </span>
                </>
              )}
            </p>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-sm text-[#3b3f46]">Not connected</p>
            {onNavigate && (
              <button
                onClick={() => onNavigate("connections")}
                className="mt-1 text-xs text-[#9ca3af] underline underline-offset-2 transition-colors hover:text-[#e8e9ea]"
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
