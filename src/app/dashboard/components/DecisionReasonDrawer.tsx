"use client";

import { useEffect, useState } from "react";
import type { DecisionReasons, GuardResult } from "@/types/api";
import { fetchDecisionReasons } from "@/lib/api";

function fmt(n: number, d = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function GuardRow({ g }: { g: GuardResult }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-2">
        <span className={g.passed ? "text-emerald-400" : "text-red-400"}>
          {g.passed ? "\u2713" : "\u2717"}
        </span>
        <span className="text-[#9ca3af]">{g.guard_name}</span>
      </div>
      {g.value !== null && g.threshold !== null && (
        <span className="font-mono text-[#9ca3af]">
          {Number(g.value).toFixed(2)} / {Number(g.threshold).toFixed(2)}
        </span>
      )}
    </div>
  );
}

export default function DecisionReasonDrawer({
  decisionId,
  onClose,
}: {
  decisionId: number;
  onClose: () => void;
}) {
  const [data, setData] = useState<DecisionReasons | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    function load() {
      setLoading(true);
      fetchDecisionReasons(decisionId)
        .then((d) => { if (!cancelled) setData(d); })
        .catch(() => { if (!cancelled) setData(null); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }
    load();
    return () => { cancelled = true; };
  }, [decisionId]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto border-l border-[#22262d] bg-[#08090c]">
        <div className="flex items-center justify-between border-b border-[#1a1d21] px-5 py-4">
          <h2 className="text-sm font-semibold">Decision #{decisionId}</h2>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-xs text-[#9ca3af] hover:text-[#e8e9ea] transition-colors"
          >
            Close
          </button>
        </div>

        {loading ? (
          <div className="p-5 text-center text-sm text-[#9ca3af]">Loading...</div>
        ) : data === null ? (
          <div className="p-5 text-center text-sm text-[#9ca3af]">Decision not found</div>
        ) : (
          <div className="space-y-5 p-5">
            {/* Summary */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs">{data.ticker}</span>
                <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                  data.verdict === "pass"
                    ? "bg-emerald-400/10 text-emerald-400"
                    : "bg-red-400/10 text-red-400"
                }`}>
                  {data.verdict}
                </span>
                {data.selected && (
                  <span className="rounded bg-blue-400/10 px-2 py-0.5 text-[10px] font-bold text-blue-400">
                    SELECTED
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[#9ca3af]">Edge: </span>
                  <span className="font-mono">{fmt(data.edge_pct, 2)}%</span>
                </div>
                <div>
                  <span className="text-[#9ca3af]">Confidence: </span>
                  <span className="font-mono">{data.confidence_score}</span>
                </div>
                <div>
                  <span className="text-[#9ca3af]">ROI/day: </span>
                  <span className="font-mono">{fmt(data.roi_per_day, 4)}</span>
                </div>
                <div>
                  <span className="text-[#9ca3af]">TTR: </span>
                  <span className="font-mono">{fmt(data.time_to_resolution_days, 1)}d</span>
                </div>
                <div>
                  <span className="text-[#9ca3af]">Size: </span>
                  <span className="font-mono">${fmt(data.suggested_size)}</span>
                </div>
                {data.selection_score !== null && (
                  <div>
                    <span className="text-[#9ca3af]">Score: </span>
                    <span className="font-mono">{fmt(data.selection_score, 4)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Guard results */}
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">
                Guard Results
              </h3>
              <div className="space-y-1 rounded border border-[#1a1d21] bg-[#050608] p-3">
                {data.guard_results.map((g, i) => (
                  <GuardRow key={i} g={g} />
                ))}
              </div>
            </div>

            {/* Allocation reasons */}
            {data.allocation_reasons && data.allocation_reasons.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">
                  Allocation Reasons
                </h3>
                <ul className="space-y-1 text-xs text-[#9ca3af]">
                  {data.allocation_reasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-amber-400">-</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Features */}
            {data.features_json && Object.keys(data.features_json).length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">
                  Signal Features
                </h3>
                <div className="space-y-1 rounded border border-[#1a1d21] bg-[#050608] p-3 text-xs">
                  {Object.entries(data.features_json).map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-[#9ca3af]">{key}</span>
                      <span className="font-mono">
                        {typeof val === "number" ? fmt(val, 4) : String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
