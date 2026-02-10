"use client";

import { useEffect, useState } from "react";
import StatsBar from "./StatsBar";
import PositionsTable from "./PositionsTable";
import ActivityFeed from "./ActivityFeed";
import MatchesTable from "./MatchesTable";
import RiskProfileEditor from "./RiskProfileEditor";
import PerformanceAnalytics from "./PerformanceAnalytics";

type View = "dashboard" | "analytics" | "settings";

function secondsAgo(date: Date) {
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
}

export default function DashboardShell() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [elapsed, setElapsed] = useState(0);
  const [view, setView] = useState<View>("dashboard");

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
    { key: "analytics", label: "Analytics" },
    { key: "settings", label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-[#050608] text-[#e8e9ea]">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-[#1a1d21] bg-[#050608]/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <a href="/" className="text-lg font-semibold tracking-tight">
              Neutralis.ai
            </a>
            <div className="flex items-center gap-1 rounded-lg border border-[#1a1d21] p-0.5">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setView(item.key)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    view === item.key
                      ? "bg-[#1a1d21] text-[#e8e9ea]"
                      : "text-[#9ca3af] hover:text-[#e8e9ea]"
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
                <span className="text-xs text-[#9ca3af]">
                  Updated {elapsed}s ago
                </span>
                <button
                  onClick={handleRefresh}
                  className="rounded border border-[#1a1d21] px-3 py-1.5 text-xs font-medium text-[#9ca3af] transition-colors hover:border-[#c0c5cb] hover:text-[#e8e9ea]"
                >
                  Refresh
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-6 pt-24 pb-16">
        {view === "settings" && (
          <section className="mt-2">
            <RiskProfileEditor />
          </section>
        )}

        {view === "analytics" && (
          <section className="mt-2">
            <PerformanceAnalytics refreshKey={refreshKey} />
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
              <ActivityFeed refreshKey={refreshKey} />
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
