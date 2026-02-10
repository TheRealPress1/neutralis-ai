"use client";

import { useEffect, useState } from "react";
import type { AutomationState, Decision } from "@/types/api";
import {
  fetchAutomationState,
  startAutomation,
  pauseAutomation,
  triggerKillSwitch,
  fetchDecisions,
} from "@/lib/api";

/* ── Helpers ─────────────────────────────────────────────────────── */

function fmt(n: number, d = 2) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_CONFIG = {
  running: {
    label: "Running",
    dot: "bg-emerald-400",
    ring: "ring-emerald-400/20",
    text: "text-emerald-400",
    bg: "bg-emerald-400/10",
  },
  paused: {
    label: "Paused",
    dot: "bg-amber-400",
    ring: "ring-amber-400/20",
    text: "text-amber-400",
    bg: "bg-amber-400/10",
  },
  killed: {
    label: "Killed",
    dot: "bg-red-400",
    ring: "ring-red-400/20",
    text: "text-red-400",
    bg: "bg-red-400/10",
  },
} as const;

/* ── Component ───────────────────────────────────────────────────── */

export default function AutomationPanel({
  refreshKey,
}: {
  refreshKey: number;
}) {
  const [state, setState] = useState<AutomationState | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [killArmed, setKillArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Fetch automation state + recent decisions */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchAutomationState(), fetchDecisions(20)])
      .then(([automationState, recentDecisions]) => {
        if (cancelled) return;
        setState(automationState);
        setDecisions(recentDecisions);
      })
      .catch(() => {
        if (!cancelled) {
          setState(null);
          setDecisions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  /* Disarm kill switch after 5 seconds if not confirmed */
  useEffect(() => {
    if (!killArmed) return;
    const timer = setTimeout(() => setKillArmed(false), 5000);
    return () => clearTimeout(timer);
  }, [killArmed]);

  /* ── Handlers ────────────────────────────────────────────────── */

  async function handleToggle() {
    if (!state || state.status === "killed") return;
    setToggling(true);
    setError(null);
    try {
      const updated =
        state.status === "running"
          ? await pauseAutomation()
          : await startAutomation();
      setState(updated);
    } catch {
      setError("Failed to toggle automation");
    } finally {
      setToggling(false);
    }
  }

  async function handleKill() {
    if (!killArmed) {
      setKillArmed(true);
      return;
    }
    setError(null);
    try {
      const updated = await triggerKillSwitch("Manual kill switch");
      setState(updated);
      setKillArmed(false);
    } catch {
      setError("Failed to trigger kill switch");
    }
  }

  /* ── Loading state ───────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="card-panel rounded-xl p-6">
          <div className="h-8 w-48 animate-pulse rounded bg-[#0a0d10]" />
          <div className="mt-4 flex gap-4">
            <div className="h-12 w-48 animate-pulse rounded-lg bg-[#0a0d10]" />
            <div className="h-12 w-40 animate-pulse rounded-lg bg-[#0a0d10]" />
          </div>
        </div>
        <div className="card-panel rounded-xl p-6">
          <div className="h-6 w-32 animate-pulse rounded bg-[#0a0d10]" />
          <div className="mt-4 grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-lg bg-[#0a0d10]"
              />
            ))}
          </div>
        </div>
        <div className="card-panel rounded-xl p-6">
          <div className="h-6 w-40 animate-pulse rounded bg-[#0a0d10]" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded bg-[#0a0d10]"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="card-panel rounded-xl p-8 text-center text-[#9ca3af]">
        Unable to load automation state
      </div>
    );
  }

  const cfg = STATUS_CONFIG[state.status];
  const isKilled = state.status === "killed";
  const isRunning = state.status === "running";
  const guardPassCount = (d: Decision) =>
    d.guard_results?.filter((g) => g.passed).length ?? 0;
  const guardTotalCount = (d: Decision) => d.guard_results?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* ── Status + Controls ──────────────────────────────────── */}
      <div className="card-panel rounded-xl">
        <div className="border-b border-[#1a1d21] px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Pulsing status dot */}
              <div
                className={`relative flex h-4 w-4 items-center justify-center`}
              >
                {isRunning && (
                  <span
                    className={`absolute inline-flex h-full w-full animate-ping rounded-full ${cfg.dot} opacity-40`}
                  />
                )}
                <span
                  className={`relative inline-flex h-3 w-3 rounded-full ${cfg.dot}`}
                />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight">
                  Automation{" "}
                  <span className={cfg.text}>{cfg.label}</span>
                </h2>
                {state.started_at && state.status === "running" && (
                  <p className="mt-0.5 text-xs text-[#9ca3af]">
                    Running since {new Date(state.started_at).toLocaleString()}
                  </p>
                )}
                {state.paused_at && state.status === "paused" && (
                  <p className="mt-0.5 text-xs text-[#9ca3af]">
                    Paused since {new Date(state.paused_at).toLocaleString()}
                  </p>
                )}
                {state.killed_at && state.status === "killed" && (
                  <p className="mt-0.5 text-xs text-[#9ca3af]">
                    Killed at {new Date(state.killed_at).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            {/* Status badge */}
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${cfg.bg} ${cfg.text} ${cfg.ring}`}
            >
              {cfg.label.toUpperCase()}
            </span>
          </div>

          {/* Killed reason banner */}
          {isKilled && state.killed_reason && (
            <div className="mt-4 rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-400">
              <span className="font-medium">Reason:</span>{" "}
              {state.killed_reason}
            </div>
          )}
        </div>

        {/* Control buttons */}
        <div className="flex flex-wrap items-center gap-4 px-6 py-5">
          {/* Start / Pause toggle */}
          <button
            onClick={handleToggle}
            disabled={toggling || isKilled}
            className={`rounded-lg px-6 py-3 text-sm font-semibold transition-colors ${
              isKilled
                ? "cursor-not-allowed bg-[#1a1d21] text-[#9ca3af]"
                : isRunning
                  ? "bg-amber-400/10 text-amber-400 hover:bg-amber-400/20"
                  : "bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20"
            }`}
          >
            {toggling
              ? "Processing..."
              : isKilled
                ? "Automation Killed"
                : isRunning
                  ? "Pause Automation"
                  : "Start Automation"}
          </button>

          {/* Kill switch */}
          <button
            onClick={handleKill}
            disabled={isKilled}
            className={`rounded-lg px-6 py-3 text-sm font-bold uppercase tracking-wider transition-all ${
              isKilled
                ? "cursor-not-allowed bg-[#1a1d21] text-[#9ca3af]"
                : killArmed
                  ? "animate-pulse bg-red-500 text-white ring-2 ring-red-400 ring-offset-2 ring-offset-[#050608]"
                  : "bg-red-400/10 text-red-400 hover:bg-red-400/20"
            }`}
          >
            {isKilled
              ? "Kill Switch Triggered"
              : killArmed
                ? "Click Again to Confirm"
                : "Kill Switch"}
          </button>

          {error && <span className="text-sm text-red-400">{error}</span>}
        </div>
      </div>

      {/* ── Risk Metrics ───────────────────────────────────────── */}
      <div className="card-panel rounded-xl">
        <div className="border-b border-[#1a1d21] px-6 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#9ca3af]">
            Risk Metrics
          </h2>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-3">
          {/* Daily Loss */}
          <div className="rounded-lg border border-[#1a1d21] bg-[#050608] p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-[#9ca3af]">
              Daily Loss
            </p>
            <p className="mt-2 font-mono text-xl font-bold text-[#e8e9ea]">
              <span
                className={
                  state.daily_loss_dollars > 0 ? "text-red-400" : "text-[#e8e9ea]"
                }
              >
                ${fmt(state.daily_loss_dollars)}
              </span>
            </p>
            {state.daily_loss_reset_at && (
              <p className="mt-1 text-[11px] text-[#9ca3af]">
                Resets {timeAgo(state.daily_loss_reset_at)}
              </p>
            )}
          </div>

          {/* Max Drawdown */}
          <div className="rounded-lg border border-[#1a1d21] bg-[#050608] p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-[#9ca3af]">
              Max Drawdown
            </p>
            <p className="mt-2 font-mono text-xl font-bold">
              <span
                className={
                  state.max_drawdown_dollars > 0
                    ? "text-red-400"
                    : "text-[#e8e9ea]"
                }
              >
                ${fmt(state.max_drawdown_dollars)}
              </span>
            </p>
          </div>

          {/* Peak Portfolio Value */}
          <div className="rounded-lg border border-[#1a1d21] bg-[#050608] p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-[#9ca3af]">
              Peak Portfolio Value
            </p>
            <p className="mt-2 font-mono text-xl font-bold text-[#e8e9ea]">
              ${fmt(state.peak_portfolio_value)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Recent Candidates ──────────────────────────────────── */}
      <div className="card-panel rounded-xl">
        <div className="border-b border-[#1a1d21] px-6 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#9ca3af]">
            Recent Candidates
          </h2>
        </div>

        <div className="max-h-[480px] overflow-y-auto">
          {decisions.length === 0 ? (
            <p className="px-6 py-10 text-center text-[#9ca3af]">
              No decisions yet
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-[#9ca3af]">
                  <th className="px-6 py-3 font-medium">Ticker</th>
                  <th className="px-6 py-3 font-medium">Verdict</th>
                  <th className="px-6 py-3 font-medium text-right">Edge</th>
                  <th className="px-6 py-3 font-medium text-right">Size</th>
                  <th className="px-6 py-3 font-medium text-right">Guards</th>
                  <th className="px-6 py-3 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {decisions.map((d) => {
                  const isPass = d.verdict === "pass";
                  return (
                    <tr
                      key={d.id}
                      className="border-t border-[#1a1d21] transition-colors hover:bg-[#0a0d10]"
                    >
                      <td className="px-6 py-3 font-mono text-xs">
                        {d.ticker}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            isPass
                              ? "bg-emerald-400/10 text-emerald-400"
                              : "bg-red-400/10 text-red-400"
                          }`}
                        >
                          {d.verdict.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right font-mono text-xs">
                        {(d.edge_pct * 100).toFixed(1)}%
                      </td>
                      <td className="px-6 py-3 text-right font-mono text-xs">
                        ${fmt(d.suggested_size)}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <span
                          className={`font-mono text-xs ${
                            guardPassCount(d) === guardTotalCount(d)
                              ? "text-emerald-400"
                              : "text-amber-400"
                          }`}
                        >
                          {guardPassCount(d)}/{guardTotalCount(d)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right text-xs text-[#9ca3af]">
                        {timeAgo(d.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
