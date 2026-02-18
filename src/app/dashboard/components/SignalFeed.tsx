"use client";

import { useEffect, useState, useCallback } from "react";
import type { EnrichedSignal, GuardResult, RegimeState } from "@/types/api";
import { fetchEnrichedSignals, fetchCurrentRegime } from "@/lib/api";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ConfidenceBadge({ score }: { score: number }) {
  let color = "text-red-400 bg-red-400/10";
  if (score >= 60) color = "text-emerald-400 bg-emerald-400/10";
  else if (score >= 35) color = "text-amber-400 bg-amber-400/10";

  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${color}`}>
      {score}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const isComp = type === "complement_arb";
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
        isComp
          ? "bg-blue-400/10 text-blue-400"
          : "bg-purple-400/10 text-purple-400"
      }`}
    >
      {isComp ? "COMP" : "X-PLAT"}
    </span>
  );
}

function SelectionBadge({ signal }: { signal: EnrichedSignal }) {
  if (signal.verdict === null) return null;
  if (signal.selected) {
    return (
      <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
        SELECTED
      </span>
    );
  }
  if (signal.verdict === "pass") {
    return (
      <span className="rounded bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
        PASSED
      </span>
    );
  }
  return (
    <span className="rounded bg-red-400/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
      REJECTED
    </span>
  );
}

function RegimeBanner({ regime }: { regime: RegimeState }) {
  const isNormal = regime.regime === "normal";
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium ${
        isNormal
          ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-400"
          : "border-amber-400/20 bg-amber-400/5 text-amber-400"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${isNormal ? "bg-emerald-400" : "bg-amber-400"}`} />
      {isNormal ? "NORMAL" : "RISK OFF"}
    </div>
  );
}

function GuardDetails({ results }: { results: GuardResult[] }) {
  return (
    <div className="mt-2 space-y-1 rounded border border-[#1a1d21] bg-[#050608] p-3">
      {results.map((g, i) => (
        <div key={i} className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className={g.passed ? "text-emerald-400" : "text-red-400"}>
              {g.passed ? "\u2713" : "\u2717"}
            </span>
            <span className="text-[#9ca3af]">{g.guard_name}</span>
          </div>
          {g.value !== null && g.threshold !== null && (
            <span className="font-mono text-[#9ca3af]">
              {Number(g.value ?? 0).toFixed(2)} / {Number(g.threshold ?? 0).toFixed(2)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

type FilterType = "all" | "complement_arb" | "cross_platform_discrepancy";
type FilterVerdict = "all" | "pass" | "reject";

export default function SignalFeed({ refreshKey }: { refreshKey: number }) {
  const [signals, setSignals] = useState<EnrichedSignal[]>([]);
  const [regime, setRegime] = useState<RegimeState>({
    regime: "normal",
    metrics_json: {},
    params_json: {},
  });
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterVerdict, setFilterVerdict] = useState<FilterVerdict>("all");
  const [minConfidence, setMinConfidence] = useState(0);

  const loadData = useCallback(() => {
    const filters: { min_confidence?: number; signal_type?: string; verdict?: string } = {};
    if (minConfidence > 0) filters.min_confidence = minConfidence;
    if (filterType !== "all") filters.signal_type = filterType;
    if (filterVerdict !== "all") filters.verdict = filterVerdict;

    Promise.all([fetchEnrichedSignals(50, filters), fetchCurrentRegime()])
      .then(([sigs, reg]) => {
        setSignals(sigs);
        setRegime(reg);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [minConfidence, filterType, filterVerdict]);

  // Load on mount and refreshKey changes
  useEffect(() => {
    function load() {
      setLoading(true);
      loadData();
    }
    load();
  }, [refreshKey, loadData]);

  // Independent 10-second polling
  useEffect(() => {
    const interval = setInterval(loadData, 10_000);
    return () => clearInterval(interval);
  }, [loadData]);

  return (
    <div className="card-panel rounded-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1a1d21] px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#9ca3af]">
          Live Signals
        </h2>
        <RegimeBanner regime={regime} />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#1a1d21] px-5 py-3">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as FilterType)}
          className="rounded border border-[#1a1d21] bg-[#0a0d10] px-2 py-1 text-xs text-[#e8e9ea]"
        >
          <option value="all">All Types</option>
          <option value="complement_arb">Complement</option>
          <option value="cross_platform_discrepancy">Cross-Platform</option>
        </select>

        <select
          value={filterVerdict}
          onChange={(e) => setFilterVerdict(e.target.value as FilterVerdict)}
          className="rounded border border-[#1a1d21] bg-[#0a0d10] px-2 py-1 text-xs text-[#e8e9ea]"
        >
          <option value="all">All Verdicts</option>
          <option value="pass">Pass</option>
          <option value="reject">Reject</option>
        </select>

        <div className="flex items-center gap-2">
          <label className="text-xs text-[#9ca3af]">Min conf:</label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={minConfidence}
            onChange={(e) => setMinConfidence(Number(e.target.value))}
            className="h-1 w-20 accent-blue-400"
          />
          <span className="min-w-[2rem] text-xs tabular-nums text-[#9ca3af]">
            {minConfidence}
          </span>
        </div>
      </div>

      {/* Signal list */}
      <div className="max-h-[420px] overflow-y-auto">
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded bg-[#0a0d10]" />
            ))}
          </div>
        ) : signals.length === 0 ? (
          <p className="px-5 py-10 text-center text-[#9ca3af]">
            No signals match filters
          </p>
        ) : (
          <ul>
            {signals.map((s) => {
              const expanded = expandedId === s.id;
              return (
                <li key={s.id} className="border-t border-[#1a1d21] px-5 py-3">
                  <button
                    onClick={() => setExpandedId(expanded ? null : s.id)}
                    className="flex w-full items-start gap-3 text-left"
                  >
                    <div className="mt-1">
                      <ConfidenceBadge score={s.confidence_score} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <TypeBadge type={s.signal_type} />
                        <span className="truncate font-mono text-xs">{s.ticker}</span>
                        <SelectionBadge signal={s} />
                        <span className="ml-auto text-xs text-[#9ca3af]">
                          {expanded ? "\u25b2" : "\u25bc"}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-[#9ca3af]">
                        <span>Edge {(s.edge_pct * 100).toFixed(1)}%</span>
                        <span>ROI/d {s.roi_per_day.toFixed(2)}%</span>
                        <span>Conf {s.confidence_score}</span>
                        <span>{timeAgo(s.signal_created_at)}</span>
                      </div>
                    </div>
                  </button>

                  {expanded && (
                    <div className="mt-2 space-y-2">
                      {/* Allocation reasons */}
                      {s.allocation_reasons && s.allocation_reasons.length > 0 && (
                        <div className="rounded border border-[#1a1d21] bg-[#050608] p-3">
                          <p className="mb-1 text-[10px] font-semibold uppercase text-[#9ca3af]">
                            Allocation
                          </p>
                          {s.allocation_reasons.map((r, i) => (
                            <p key={i} className="text-xs text-[#9ca3af]">{r}</p>
                          ))}
                        </div>
                      )}
                      {/* Guard results */}
                      {s.guard_results && s.guard_results.length > 0 && (
                        <GuardDetails results={s.guard_results} />
                      )}
                    </div>
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
