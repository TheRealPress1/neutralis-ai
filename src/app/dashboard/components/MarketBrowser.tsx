"use client";

import { useEffect, useState } from "react";
import type { MarketSnapshot } from "@/types/api";
import { fetchMarketSnapshots } from "@/lib/api";
import MatchesTable from "./MatchesTable";

const VENUES = ["all", "kalshi", "polymarket"] as const;
const SUB_TABS = ["browse", "pairs"] as const;
type SubTab = (typeof SUB_TABS)[number];

function priceFmt(p: number) {
  return p > 0 ? `${(p * 100).toFixed(0)}c` : "-";
}

export default function MarketBrowser({ refreshKey }: { refreshKey: number }) {
  const [subTab, setSubTab] = useState<SubTab>("browse");
  const [markets, setMarkets] = useState<MarketSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [venue, setVenue] = useState<string>("all");

  useEffect(() => {
    if (subTab !== "browse") return;
    setLoading(true);
    fetchMarketSnapshots({
      limit: 100,
      venue: venue === "all" ? undefined : venue,
      q: query || undefined,
    })
      .then(setMarkets)
      .catch(() => setMarkets([]))
      .finally(() => setLoading(false));
  }, [refreshKey, venue, query, subTab]);

  // Debounce search input
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQuery(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  return (
    <div className="hud-panel rounded-xl">
      {/* Header + Sub-tabs + Filters */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <h2 className="font-mono text-sm font-medium uppercase tracking-[0.1em] text-text-primary">
              Markets
            </h2>
            {/* Sub-tab toggle */}
            <div className="flex items-center rounded-lg border border-border p-0.5">
              {SUB_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSubTab(tab)}
                  className={`rounded-md px-3 py-1 text-[11px] font-medium transition-colors ${
                    subTab === tab
                      ? "bg-neon-green/10 text-neon-green"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {tab === "browse" ? "Browse" : "Pairs"}
                </button>
              ))}
            </div>
          </div>
          {subTab === "browse" && (
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search markets..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded-lg bg-[#060810] border border-border px-4 py-2.5 text-sm text-text-primary font-mono placeholder:text-text-secondary focus:outline-none focus:border-neon-blue/50 focus:shadow-[0_0_8px_rgba(0,212,255,0.1)] transition-all"
              />
              <div className="flex items-center gap-1">
                {VENUES.map((v) => (
                  <button
                    key={v}
                    onClick={() => setVenue(v)}
                    className={`rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors ${
                      venue === v
                        ? "border-neon-blue/30 bg-neon-blue/10 text-neon-blue"
                        : "border-border text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {v === "all" ? "All" : v === "polymarket" ? "Polymarket" : "Kalshi"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {subTab === "browse" ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-[10px] font-medium uppercase tracking-wider text-text-secondary">
                <th className="px-6 py-3">Market</th>
                <th className="px-3 py-3">Venue</th>
                <th className="px-3 py-3 text-right">Yes Bid</th>
                <th className="px-3 py-3 text-right">Yes Ask</th>
                <th className="px-3 py-3 text-right">Spread</th>
                <th className="px-3 py-3 text-right">Updated</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[#3b3f46]">
                    Loading...
                  </td>
                </tr>
              ) : markets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[#3b3f46]">
                    No markets found
                  </td>
                </tr>
              ) : (
                markets.map((m) => {
                  const spread = m.yes_ask > 0 && m.yes_bid > 0
                    ? ((m.yes_ask - m.yes_bid) * 100).toFixed(1)
                    : "-";
                  return (
                    <tr
                      key={`${m.venue}-${m.ticker}`}
                      className="border-b border-[#0a0d10] transition-colors hover:bg-[#0a0d10]"
                    >
                      <td className="max-w-xs truncate px-6 py-2.5 text-text-primary">
                        <span className="font-medium">{m.title}</span>
                        <span className="ml-2 text-[10px] text-[#3b3f46]">{m.ticker}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          m.venue === "kalshi"
                            ? "bg-neon-blue/10 text-neon-blue"
                            : "bg-neon-purple/10 text-neon-purple"
                        }`}>
                          {m.venue === "kalshi" ? "Kalshi" : "Polymarket"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-text-primary">
                        {priceFmt(m.yes_bid)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-text-primary">
                        {priceFmt(m.yes_ask)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-text-secondary">
                        {spread !== "-" ? `${spread}c` : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[#3b3f46]">
                        {new Date(m.snapshot_ts).toLocaleTimeString("en-US", {
                          hour12: false,
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <MatchesTable refreshKey={refreshKey} />
      )}
    </div>
  );
}
