"use client";

import { useEffect, useState } from "react";
import BalanceBar from "./BalanceBar";
import StatsBar from "./StatsBar";
import PositionsTable from "./PositionsTable";
import ActivityFeed from "./ActivityFeed";
import MatchesTable from "./MatchesTable";
import SettingsPage from "./SettingsPage";
import AutomationPanel from "./AutomationPanel";
import ActivityLog from "./ActivityLog";
import SetupBanner from "./SetupBanner";
import ApiKeyManager from "./ApiKeyManager";
import UpgradeBanner from "./UpgradeBanner";
import AuthNav from "@/app/components/AuthNav";
import Link from "next/link";
import { hasAccess, type SubscriptionTier } from "@/lib/subscription";

type NavTab = "dashboard" | "automation" | "activity" | "matches" | "connections" | "settings";

const NAV_ITEMS: { id: NavTab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "automation", label: "Automation" },
  { id: "activity", label: "Activity" },
  { id: "matches", label: "Explore" },
  { id: "connections", label: "Connections" },
  { id: "settings", label: "Settings" },
];

function secondsAgo(date: Date) {
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
}

export default function DashboardShell({
  initialTier = "free",
  initialIsFounder = false,
  initialHasApiKeys = true,
}: {
  initialTier?: SubscriptionTier;
  initialIsFounder?: boolean;
  initialHasApiKeys?: boolean;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [elapsed, setElapsed] = useState(0);
  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const tier = initialTier;
  const isFounder = initialIsFounder;

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
      {/* Top Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-[#1a1d21] bg-[#050608]/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-8">
            <Link href="/" className="font-[family-name:var(--font-italiana)] text-xl font-normal tracking-[0.08em] text-white/90">
              Neutralis.ai
            </Link>
            {/* Tab navigation */}
            <div className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === item.id
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
            <span className="text-xs text-[#9ca3af]">
              Updated {elapsed}s ago
            </span>
            <button
              onClick={handleRefresh}
              className="rounded border border-[#1a1d21] px-3 py-1.5 text-xs font-medium text-[#9ca3af] transition-colors hover:border-[#c0c5cb] hover:text-[#e8e9ea]"
            >
              Refresh
            </button>
            <AuthNav />
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-6 pt-20 pb-16">
        {activeTab === "dashboard" && (
          <>
            {!initialHasApiKeys && (
              <section className="mb-4">
                <SetupBanner onNavigate={setActiveTab} />
              </section>
            )}
            <section>
              <BalanceBar refreshKey={refreshKey} onNavigate={setActiveTab} />
            </section>
            <section className="mt-4">
              <StatsBar refreshKey={refreshKey} />
            </section>
            <section className="mt-6 grid gap-6 lg:grid-cols-2">
              <PositionsTable refreshKey={refreshKey} />
              <ActivityFeed refreshKey={refreshKey} />
            </section>
          </>
        )}

        {activeTab === "automation" && (
          <section className="mt-2">
            {!hasAccess(tier, "starter") ? (
              <UpgradeBanner
                feature="Automated execution"
                requiredTier="starter"
              />
            ) : (
              <AutomationPanel refreshKey={refreshKey} />
            )}
          </section>
        )}

        {activeTab === "activity" && (
          <section className="mt-2">
            <ActivityLog refreshKey={refreshKey} />
          </section>
        )}

        {activeTab === "matches" && (
          <section className="mt-2">
            <MatchesTable refreshKey={refreshKey} />
          </section>
        )}

        {activeTab === "connections" && (
          <section className="mt-2">
            <ApiKeyManager />
          </section>
        )}

        {activeTab === "settings" && (
          <section className="mt-2">
            <SettingsPage tier={tier} isFounder={isFounder} />
          </section>
        )}
      </main>
    </div>
  );
}
