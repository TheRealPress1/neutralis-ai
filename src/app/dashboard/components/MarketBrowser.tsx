"use client";

import { useEffect, useState } from "react";
import type { MarketSnapshot } from "@/types/api";
import { fetchMarketSnapshots } from "@/lib/api";
import MatchesTable from "./MatchesTable";

const VENUES = ["all", "kalshi", "polymarket", "polymarket_us"] as const;
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
    <div className="card-panel rounded-xl">
      {/* Header + Sub-tabs + Filters */}
      <div className="border-b border-[#1a1d21] px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <h2 className="font-[family-name:var(--font-italiana)] text-xl font-normal tracking-[0.04em]">
              Markets
            </h2>
            {/* Sub-tab toggle */}
            <div className="flex items-center rounded-lg border border-[#1a1d21] p-0.5">
              {SUB_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSubTab(tab)}
                  className={`rounded-md px-3 py-1 text-[11px] font-medium transition-colors ${
                    subTab === tab
                      ? "bg-[#1a1d21] text-[#e8e9ea]"
                      : "text-[#9ca3af] hover:text-[#e8e9ea]"
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
                className="h-8 w-56 rounded-md border border-[#1a1d21] bg-[#050608] px-3 text-xs text-[#e8e9ea] placeholder-[#3b3f46] outline-none focus:border-[#c0c5cb]"
              />
              <div className="flex items-center gap-1">
                {VENUES.map((v) => (
                  <button
                    key={v}
                    onClick={() => setVenue(v)}
                    className={`rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors ${
                      venue === v
                        ? "bg-[#1a1d21] text-[#e8e9ea]"
                        : "text-[#9ca3af] hover:text-[#e8e9ea]"
                    }`}
                  >
                    {v === "all" ? "All" : v === "polymarket_us" ? "Poly US" : v.charAt(0).toUpperCase() + v.slice(1)}
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
              <tr className="border-b border-[#1a1d21] text-[10px] font-medium uppercase tracking-wider text-[#9ca3af]">
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
                      <td className="max-w-xs truncate px-6 py-2.5 text-[#e8e9ea]">
                        <span className="font-medium">{m.title}</span>
                        <span className="ml-2 text-[10px] text-[#3b3f46]">{m.ticker}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          m.venue === "kalshi"
                            ? "bg-blue-400/10 text-blue-400"
                            : m.venue === "polymarket_us"
                              ? "bg-amber-400/10 text-amber-400"
                              : "bg-purple-400/10 text-purple-400"
                        }`}>
                          {m.venue === "polymarket_us" ? "Poly US" : m.venue}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[#e8e9ea]">
                        {priceFmt(m.yes_bid)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[#e8e9ea]">
                        {priceFmt(m.yes_ask)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[#9ca3af]">
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
