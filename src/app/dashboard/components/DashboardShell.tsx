"use client";

import { useEffect, useState } from "react";
import StatsBar from "./StatsBar";
import PositionsTable from "./PositionsTable";
import ActivityFeed from "./ActivityFeed";
import MatchesTable from "./MatchesTable";
import RiskProfileEditor from "./RiskProfileEditor";

function secondsAgo(date: Date) {
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
}

export default function DashboardShell() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [elapsed, setElapsed] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

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

  return (
    <div className="min-h-screen bg-[#050608] text-[#e8e9ea]">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-[#1a1d21] bg-[#050608]/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <a href="/" className="text-lg font-semibold tracking-tight">
              Neutralis.ai
            </a>
            <span className="text-sm font-medium text-[#9ca3af]">
              Dashboard
            </span>
          </div>
          <div className="flex items-center gap-3">
            {!showSettings && (
              <span className="text-xs text-[#9ca3af]">
                Updated {elapsed}s ago
              </span>
            )}
            {!showSettings && (
              <button
                onClick={handleRefresh}
                className="rounded border border-[#1a1d21] px-3 py-1.5 text-xs font-medium text-[#9ca3af] transition-colors hover:border-[#c0c5cb] hover:text-[#e8e9ea]"
              >
                Refresh
              </button>
            )}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="rounded border border-[#1a1d21] px-3 py-1.5 text-xs font-medium text-[#9ca3af] transition-colors hover:border-[#c0c5cb] hover:text-[#e8e9ea]"
            >
              {showSettings ? "Dashboard" : "Settings"}
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-6 pt-24 pb-16">
        {showSettings ? (
          <section className="mt-2">
            <RiskProfileEditor />
          </section>
        ) : (
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
