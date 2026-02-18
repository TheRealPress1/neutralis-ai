"use client";

import { useEffect, useState } from "react";
import type { MarketMatch } from "@/types/api";
import { fetchMatches } from "@/lib/api";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function confidenceColor(c: number) {
  if (c >= 0.8) return "text-emerald-400";
  if (c >= 0.6) return "text-amber-400";
  return "text-red-400";
}

export default function MatchesTable({ refreshKey }: { refreshKey: number }) {
  const [matches, setMatches] = useState<MarketMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    function load() {
      setLoading(true);
      fetchMatches(25)
        .then((d) => { if (!cancelled) setMatches(d); })
        .catch(() => { if (!cancelled) setMatches([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }
    load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  return (
    <div className="card-panel rounded-xl">
      <div className="border-b border-[#1a1d21] px-5 py-4">
        <h2 className="font-[family-name:var(--font-cormorant)] text-base font-medium tracking-wide text-[#9ca3af]">
          Cross-Platform Matches
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-[#9ca3af]">
              <th className="px-5 py-3 font-medium">Kalshi Market</th>
              <th className="px-5 py-3 font-medium">Polymarket Market</th>
              <th className="px-5 py-3 font-medium text-right">Confidence</th>
              <th className="px-5 py-3 font-medium text-right">Matched</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-t border-[#1a1d21]">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <td key={j} className="px-5 py-3">
                      <div className="h-4 w-24 animate-pulse rounded bg-[#12151a]" />
                    </td>
                  ))}
                </tr>
              ))
            ) : matches.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mb-3 h-10 w-10 text-[#2a2d31]">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                    </svg>
                    <p className="text-sm text-[#9ca3af]">No cross-platform matches found</p>
                    <p className="mt-1 text-xs text-[#3b3f46]">
                      Matched market pairs across Kalshi and Polymarket will appear here.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              matches.map((m) => (
                <tr key={m.id} className="border-t border-[#1a1d21] transition-colors hover:bg-white/[0.02]">
                  <td className="max-w-[260px] px-5 py-3">
                    <p className="truncate text-sm" title={m.kalshi_title}>
                      {m.kalshi_title}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-[#9ca3af]">
                      {m.kalshi_ticker}
                    </p>
                  </td>
                  <td className="max-w-[260px] px-5 py-3">
                    <p className="truncate text-sm" title={m.polymarket_question}>
                      {m.polymarket_question}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-[#9ca3af]">
                      {m.polymarket_id.slice(0, 16)}...
                    </p>
                  </td>
                  <td
                    className={`px-5 py-3 text-right font-mono ${confidenceColor(
                      m.match_confidence,
                    )}`}
                  >
                    {(m.match_confidence * 100).toFixed(1)}%
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-[#9ca3af]">
                    {timeAgo(m.created_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
