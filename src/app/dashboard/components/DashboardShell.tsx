"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import BalanceBar from "./BalanceBar";
import StatsBar from "./StatsBar";
import PositionsTable from "./PositionsTable";
import ActivityFeed from "./ActivityFeed";
import SettingsPage from "./SettingsPage";
import ActivityTimeline from "./ActivityTimeline";
import SetupBanner from "./SetupBanner";
import ApiKeyManager from "./ApiKeyManager";
import AccessCodeGenerator from "./AccessCodeGenerator";
import MarketBrowser from "./MarketBrowser";
import AuthNav from "@/app/components/AuthNav";
import Link from "next/link";
import { hasAccess, type SubscriptionTier } from "@/lib/subscription";
import { useRealtimeDashboard } from "@/hooks/useRealtimeDashboard";

type NavTab = "dashboard" | "activity" | "markets" | "connections" | "settings" | "founder";

const BASE_NAV_ITEMS: { id: NavTab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "activity", label: "Activity" },
  { id: "markets", label: "Markets" },
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
  const tier = initialTier;
  const isFounder = initialIsFounder;

  const router = useRouter();
  const searchParams = useSearchParams();
  const VALID_TABS = useMemo(() => new Set<NavTab>(["dashboard", "activity", "markets", "connections", "settings", "founder"]), []);

  const rawTab = searchParams.get("tab") ?? "dashboard";
  const activeTab: NavTab = VALID_TABS.has(rawTab as NavTab) ? (rawTab as NavTab) : "dashboard";

  const setActiveTab = useCallback((tab: NavTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "dashboard") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const qs = params.toString();
    router.push(`/dashboard${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [router, searchParams]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    setLastRefreshed(new Date());
  }, []);

  // Supabase Realtime: push-based updates on table changes
  const { isConnected: realtimeConnected } = useRealtimeDashboard(handleRefresh);

  // Fallback: poll every 30s if Realtime is not connected
  useEffect(() => {
    if (realtimeConnected) return;
    const interval = setInterval(handleRefresh, 30_000);
    return () => clearInterval(interval);
  }, [realtimeConnected, handleRefresh]);

  // Update "Xs ago" display every second
  useEffect(() => {
    const tick = setInterval(() => setElapsed(secondsAgo(lastRefreshed)), 1000);
    return () => clearInterval(tick);
  }, [lastRefreshed]);

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary dashboard-grid scan-line">
      {/* Top Nav */}
      <nav className="fixed top-0 z-50 w-full bg-bg-primary/85 backdrop-blur-xl">
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
                  className={`relative rounded-md px-3 py-1.5 text-xs font-mono font-medium uppercase tracking-wider transition-colors ${
                    activeTab === item.id
                      ? "text-neon-green"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {item.label}
                  {activeTab === item.id && (
                    <span className="absolute bottom-0 left-1 right-1 h-px bg-neon-green" />
                  )}
                </button>
              ))}
              {!hasAccess(tier, "starter") && (
                <Link
                  href="/pricing"
                  className="ml-2 rounded-md border border-neon-green/30 bg-neon-green/10 px-3 py-1.5 text-xs font-mono font-medium uppercase tracking-wider text-neon-green transition-colors hover:bg-neon-green/20"
                >
                  Upgrade
                </Link>
              )}

              {/* External exchange links */}
              <span className="mx-2 h-4 w-px bg-border" />
              <a
                href="https://kalshi.com/portfolio"
                target="_blank"
                rel="noopener noreferrer"
                title="Kalshi"
                className="flex items-center justify-center rounded opacity-60 transition-all hover:opacity-100 hover:drop-shadow-[0_0_4px_rgba(0,255,170,0.3)]"
              >
                <img src="/kalshi-icon.png" alt="Kalshi" className="h-[22px] w-[22px]" />
              </a>
              <a
                href="https://polymarket.us"
                target="_blank"
                rel="noopener noreferrer"
                title="Polymarket US"
                className="flex items-center justify-center rounded opacity-60 transition-all hover:opacity-100 hover:drop-shadow-[0_0_4px_rgba(0,255,170,0.3)]"
              >
                <img src="/polymarket-icon.svg" alt="Polymarket US" className="h-[22px] w-[22px]" />
              </a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Realtime indicator */}
            <span
              className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                realtimeConnected
                  ? "bg-neon-green/10 text-neon-green"
                  : "bg-bg-elevated text-text-secondary"
              }`}
              title={realtimeConnected ? "Live — updates pushed in real time" : `Polling — updated ${elapsed}s ago`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  realtimeConnected ? "bg-neon-green neon-pulse shadow-[0_0_6px_rgba(0,255,170,0.6)]" : "bg-text-secondary"
                }`}
              />
              {realtimeConnected ? "Live" : `${elapsed}s`}
            </span>
            <button
              onClick={handleRefresh}
              title={`Updated ${elapsed}s ago`}
              className="group flex h-8 w-8 items-center justify-center rounded-md border border-border text-text-secondary transition-all hover:border-neon-green/30 hover:text-neon-green hover:shadow-[0_0_8px_rgba(0,255,170,0.1)]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-3.5 w-3.5 transition-transform duration-500 group-hover:rotate-180"
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
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-green/20 to-transparent" />
      </nav>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-6 pt-20 pb-16 relative">
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

        {activeTab === "activity" && (
          <section className="mt-2">
            <ActivityTimeline refreshKey={refreshKey} />
          </section>
        )}

        {activeTab === "markets" && (
          <section className="mt-2">
            <MarketBrowser refreshKey={refreshKey} />
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
