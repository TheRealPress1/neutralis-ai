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
import AccessCodeGenerator from "./AccessCodeGenerator";
import AuthNav from "@/app/components/AuthNav";
import Link from "next/link";
import { hasAccess, type SubscriptionTier } from "@/lib/subscription";

type NavTab = "dashboard" | "automation" | "activity" | "matches" | "connections" | "settings" | "founder";

const BASE_NAV_ITEMS: { id: NavTab; label: string }[] = [
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
  initialHasBothVenues = false,
  initialHasKalshi = false,
  initialHasPoly = false,
}: {
  initialTier?: SubscriptionTier;
  initialIsFounder?: boolean;
  initialHasApiKeys?: boolean;
  initialHasBothVenues?: boolean;
  initialHasKalshi?: boolean;
  initialHasPoly?: boolean;
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
              {[...BASE_NAV_ITEMS, ...(isFounder ? [{ id: "founder" as NavTab, label: "Founder Tools" }] : [])].map((item) => (
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
              {!hasAccess(tier, "starter") && (
                <Link
                  href="/pricing"
                  className="ml-2 rounded-md bg-[#e8e9ea] px-3 py-1.5 text-xs font-medium text-[#050608] transition-colors hover:bg-[#c0c5cb]"
                >
                  Upgrade
                </Link>
              )}

              {/* External exchange links */}
              <span className="mx-2 h-4 w-px bg-[#3b3f46]" />
              <a
                href="https://kalshi.com/portfolio"
                target="_blank"
                rel="noopener noreferrer"
                title="Kalshi"
                className="flex items-center justify-center rounded opacity-85 transition-opacity hover:opacity-100"
              >
                <img src="/kalshi-icon.png" alt="Kalshi" className="h-[22px] w-[22px]" />
              </a>
              <a
                href="https://polymarket.us"
                target="_blank"
                rel="noopener noreferrer"
                title="Polymarket US"
                className="flex items-center justify-center rounded opacity-85 transition-opacity hover:opacity-100"
              >
                <img src="/polymarket-icon.svg" alt="Polymarket US" className="h-[22px] w-[22px]" />
              </a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              title={`Updated ${elapsed}s ago`}
              className="group flex h-8 w-8 items-center justify-center rounded-md border border-[#1a1d21] text-[#9ca3af] transition-colors hover:border-[#c0c5cb] hover:text-[#e8e9ea]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-3.5 w-3.5 transition-transform group-hover:rotate-45"
              >
                <path
                  fillRule="evenodd"
                  d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H4.598a.75.75 0 0 0-.75.75v3.634a.75.75 0 0 0 1.5 0v-2.033l.312.311a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm-10.624-2.85a5.5 5.5 0 0 1 9.201-2.465l.312.311H11.77a.75.75 0 0 0 0 1.5h3.634a.75.75 0 0 0 .75-.75V3.536a.75.75 0 0 0-1.5 0v2.033l-.312-.311A7 7 0 0 0 2.63 8.396a.75.75 0 0 0 1.45.39l-.392.788Z"
                  clipRule="evenodd"
                />
              </svg>
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
              <AutomationPanel
                refreshKey={refreshKey}
                hasBothVenues={initialHasBothVenues}
                hasKalshi={initialHasKalshi}
                hasPoly={initialHasPoly}
                onNavigate={setActiveTab}
              />
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
            <SettingsPage tier={tier} />
          </section>
        )}

        {activeTab === "founder" && isFounder && (
          <section className="mt-2">
            <AccessCodeGenerator />
          </section>
        )}
      </main>
    </div>
  );
}
