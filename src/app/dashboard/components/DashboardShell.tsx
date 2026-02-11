"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import StatsBar from "./StatsBar";
import PositionsTable from "./PositionsTable";
import SignalFeed from "./SignalFeed";
import MatchesTable from "./MatchesTable";
import RiskProfileEditor from "./RiskProfileEditor";
import PerformanceAnalytics from "./PerformanceAnalytics";
import BacktestPanel from "./BacktestPanel";
import ExecutionPanel from "./ExecutionPanel";
import ApiKeyManager from "./ApiKeyManager";
import AuthNav from "@/app/components/AuthNav";

type View = "dashboard" | "execution" | "analytics" | "backtest" | "connections" | "settings";

function secondsAgo(date: Date) {
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
}

export default function DashboardShell() {
  const searchParams = useSearchParams();
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [elapsed, setElapsed] = useState(0);
  const initialTab = (searchParams.get("tab") as View) || "dashboard";
  const [view, setView] = useState<View>(initialTab);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey((k) => k + 1);
      setLastRefreshed(new Date());
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Update "Xs ago" display every second
  useEffect(() => {
    const tick = setInterval(() => setElapsed(secondsAgo(lastRefreshed)), 1000);
    return () => clearInterval(tick);
  }, [lastRefreshed]);

  function handleRefresh() {
    setRefreshKey((k) => k + 1);
    setLastRefreshed(new Date());
  }

  const NAV_ITEMS: { key: View; label: string }[] = [
    { key: "dashboard", label: "Dashboard" },
    { key: "execution", label: "Execution" },
    { key: "analytics", label: "Analytics" },
    { key: "backtest", label: "Backtest" },
    { key: "connections", label: "Connections" },
    { key: "settings", label: "Portfolio Settings" },
  ];

  return (
    <div className="min-h-screen bg-[#08090c] text-[#eceef0]">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-[#22262d] bg-[#08090c]/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <a href="/" className="text-lg font-semibold tracking-tight">
              Neutralis.ai
            </a>
            <span className="text-xs text-[#a1a8b3]">/</span>
            <span className="text-sm font-medium text-[#eceef0]">
              My Portfolio
            </span>
            <div className="flex items-center gap-1 rounded-lg border border-[#22262d] p-0.5">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setView(item.key)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    view === item.key
                      ? "bg-[#1a1f27] text-[#eceef0]"
                      : "text-[#a1a8b3] hover:text-[#eceef0]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {view === "dashboard" && (
              <>
                <span className="text-xs text-[#a1a8b3]">
                  Updated {elapsed}s ago
                </span>
                <button
                  onClick={handleRefresh}
                  className="rounded border border-[#22262d] px-3 py-1.5 text-xs font-medium text-[#a1a8b3] transition-colors hover:border-[#c0c5cb] hover:text-[#eceef0]"
                >
                  Refresh
                </button>
              </>
            )}
            <ul className="flex items-center">
              <AuthNav />
            </ul>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-6 pt-24 pb-16">
        {view === "connections" && (
          <section className="mt-2">
            <ApiKeyManager />
          </section>
        )}

        {view === "settings" && (
          <section className="mt-2">
            <RiskProfileEditor />
          </section>
        )}

        {view === "execution" && (
          <section className="mt-2">
            <ExecutionPanel refreshKey={refreshKey} />
          </section>
        )}

        {view === "analytics" && (
          <section className="mt-2">
            <PerformanceAnalytics refreshKey={refreshKey} />
          </section>
        )}

        {view === "backtest" && (
          <section className="mt-2">
            <BacktestPanel />
          </section>
        )}

        {view === "dashboard" && (
          <>
            {/* Stats bar */}
            <section>
              <StatsBar refreshKey={refreshKey} />
            </section>

            {/* Two-column: Positions + Activity */}
            <section className="mt-6 grid gap-6 lg:grid-cols-2">
              <PositionsTable refreshKey={refreshKey} />
              <SignalFeed refreshKey={refreshKey} />
            </section>

            {/* Matches */}
            <section className="mt-6">
              <MatchesTable refreshKey={refreshKey} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
