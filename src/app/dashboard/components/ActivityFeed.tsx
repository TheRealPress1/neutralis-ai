"use client";

import { useEffect, useState } from "react";
import type { ActivityItem, GuardResult } from "@/types/api";
import { fetchSignals, fetchDecisions } from "@/lib/api";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function GuardDetails({ results }: { results: GuardResult[] }) {
  return (
    <div className="mt-2 space-y-1 rounded border border-border bg-bg-primary p-3">
      {results.map((g, i) => (
        <div key={i} className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className={g.passed ? "text-neon-green" : "text-neon-red"}>
              {g.passed ? "\u2713" : "\u2717"}
            </span>
            <span className="text-text-secondary">{g.guard_name}</span>
          </div>
          {g.value !== null && g.threshold !== null && (
            <span className="font-mono text-text-mono">
              {g.value.toFixed(2)} / {g.threshold.toFixed(2)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ActivityFeed({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    function load() {
      setLoading(true);
      Promise.all([fetchSignals(20), fetchDecisions(20)])
        .then(([signals, decisions]) => {
          if (cancelled) return;
          const merged: ActivityItem[] = [
            ...signals.map((s) => ({ kind: "signal" as const, data: s })),
            ...decisions.map((d) => ({ kind: "decision" as const, data: d })),
          ];
          merged.sort(
            (a, b) =>
              new Date(b.data.created_at).getTime() -
              new Date(a.data.created_at).getTime(),
          );
          setItems(merged);
        })
        .catch(() => { if (!cancelled) setItems([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }
    load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  return (
    <div className="hud-panel">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-text-secondary">
          Activity
        </h2>
      </div>

      <div className="max-h-[420px] overflow-y-auto">
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 skeleton" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mb-3 h-10 w-10 text-border">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
            <p className="text-sm text-text-secondary">No activity yet</p>
            <p className="mt-1 text-xs text-border">
              Signals and decisions will stream here in real time.
            </p>
          </div>
        ) : (
          <ul>
            {items.map((item) => {
              if (item.kind === "signal") {
                const s = item.data;
                return (
                  <li
                    key={`s-${s.id}`}
                    className="flex items-start gap-3 border-t border-border px-5 py-3 transition-colors hover:bg-white/[0.02]"
                  >
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-neon-blue" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-neon-blue/10 px-1.5 py-0.5 text-[10px] font-medium text-neon-blue">
                          SIGNAL
                        </span>
                        <span className="truncate font-mono text-xs">
                          {s.ticker}
                        </span>
                      </div>
                      <div className="mt-1 flex gap-3 text-xs text-text-secondary">
                        <span>
                          {s.signal_type === "complement_arb"
                            ? "Complement"
                            : "Cross-platform"}
                        </span>
                        <span>Edge {(s.edge_pct * 100).toFixed(1)}%</span>
                        <span>{timeAgo(s.created_at)}</span>
                      </div>
                    </div>
                  </li>
                );
              }

              const d = item.data;
              const isPass = d.verdict === "pass";
              const expanded = expandedId === d.id;
              return (
                <li
                  key={`d-${d.id}`}
                  className="border-t border-border px-5 py-3 transition-colors hover:bg-white/[0.02]"
                >
                  <button
                    onClick={() => setExpandedId(expanded ? null : d.id)}
                    className="flex w-full items-start gap-3 text-left"
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        isPass ? "bg-neon-green" : "bg-neon-red"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            isPass
                              ? "bg-neon-green/10 text-neon-green"
                              : "bg-neon-red/10 text-neon-red"
                          }`}
                        >
                          {d.verdict.toUpperCase()}
                        </span>
                        <span className="truncate font-mono text-xs">
                          {d.ticker}
                        </span>
                        <span className="ml-auto text-xs text-text-secondary">
                          {expanded ? "\u25b2" : "\u25bc"}
                        </span>
                      </div>
                      <div className="mt-1 flex gap-3 text-xs text-text-secondary">
                        <span>Edge {(d.edge_pct * 100).toFixed(1)}%</span>
                        <span>Size ${d.suggested_size.toFixed(2)}</span>
                        <span>{timeAgo(d.created_at)}</span>
                      </div>
                    </div>
                  </button>
                  {expanded && d.guard_results?.length > 0 && (
                    <GuardDetails results={d.guard_results} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
