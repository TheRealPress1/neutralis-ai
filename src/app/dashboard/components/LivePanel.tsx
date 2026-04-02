"use client";

import { useEffect, useRef, useState } from "react";
import type { PipelineLog, EngineHealth, AutomationState, Decision } from "@/types/api";
import { fetchPipelineLogs, fetchEngineHealth, fetchAutomationState, fetchDecisions } from "@/lib/api";
import { setAutomationStatus } from "@/app/actions/dashboard";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/* ── Helpers ─────────────────────────────────────────────────────── */

const LEVEL_STYLES: Record<string, { dot: string; text: string }> = {
  info: { dot: "bg-[#9ca3af]", text: "text-[#9ca3af]" },
  warn: { dot: "bg-amber-400", text: "text-amber-400" },
  error: { dot: "bg-red-400", text: "text-red-400" },
  signal: { dot: "bg-blue-400", text: "text-blue-400" },
  order: { dot: "bg-emerald-400", text: "text-emerald-400" },
  guard: { dot: "bg-purple-400", text: "text-purple-400" },
};

function levelStyle(level: string) {
  return LEVEL_STYLES[level] ?? LEVEL_STYLES.info;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
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

function fmt(n: number, d = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function WsDot({ connected }: { connected?: boolean }) {
  return (
    <span className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`} />
  );
}

function wsCount(h: EngineHealth) {
  let count = 0;
  if (h.kalshi_ws_connected) count++;
  if (h.poly_ws_connected) count++;
  if (h.poly_us_ws_connected) count++;
  return count;
}

function totalMarkets(h: EngineHealth) {
  return (h.kalshi_markets ?? 0) + (h.poly_markets ?? 0) + (h.poly_us_markets ?? 0);
}

/* ── Component ───────────────────────────────────────────────────── */

export default function LivePanel({
  refreshKey,
  hasBothVenues = false,
  hasKalshi = false,
  hasPoly = false,
  onNavigate,
}: {
  refreshKey: number;
  hasBothVenues?: boolean;
  hasKalshi?: boolean;
  hasPoly?: boolean;
  onNavigate?: (tab: any) => void;
}) {
  // Engine health
  const [health, setHealth] = useState<EngineHealth | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  const [retryTick, setRetryTick] = useState(0);

  // Automation state
  const [autoState, setAutoState] = useState<AutomationState | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [toggling, setToggling] = useState(false);
  const [killArmed, setKillArmed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Pipeline logs
  const [logs, setLogs] = useState<PipelineLog[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  /* ── Engine health polling ──────────────────────────────────── */
  useEffect(() => {
    cancelledRef.current = false;
    let delay = 3_000;
    function poll() {
      fetchEngineHealth()
        .then((h) => {
          if (cancelledRef.current) return;
          setHealth(h);
          delay = h.status === "unreachable" ? Math.min(delay * 1.5, 30_000) : 3_000;
        })
        .catch(() => { delay = Math.min(delay * 1.5, 30_000); })
        .finally(() => { if (!cancelledRef.current) pollRef.current = setTimeout(poll, delay); });
    }
    poll();
    return () => { cancelledRef.current = true; if (pollRef.current) clearTimeout(pollRef.current); };
  }, [retryTick]);

  /* ── Automation state + decisions ───────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchAutomationState(), fetchDecisions(20)])
      .then(([s, d]) => { if (!cancelled) { setAutoState(s); setDecisions(d); } })
      .catch(() => { if (!cancelled) { setAutoState(null); setDecisions([]); } });
    return () => { cancelled = true; };
  }, [refreshKey]);

  /* ── Kill switch auto-disarm ────────────────────────────────── */
  useEffect(() => {
    if (!killArmed) return;
    const t = setTimeout(() => setKillArmed(false), 5000);
    return () => clearTimeout(t);
  }, [killArmed]);

  /* ── Pipeline logs: initial + realtime ──────────────────────── */
  useEffect(() => {
    fetchPipelineLogs(200).then((data) => setLogs(data.reverse())).catch(() => {});
  }, [refreshKey]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    async function subscribe() {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      const channel = supabase
        .channel("pipeline-logs-live")
        .on("postgres_changes" as any, {
          event: "INSERT", schema: "public", table: "pipeline_logs",
          filter: `user_id=eq.${user.id}`,
        }, (payload: any) => {
          setLogs((prev) => [...prev.slice(-499), payload.new as PipelineLog]);
        })
        .subscribe();
      channelRef.current = channel;
    }
    subscribe();
    return () => {
      cancelled = true;
      if (channelRef.current) { createClient().removeChannel(channelRef.current); channelRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (autoScroll && logEndRef.current) logEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [logs, autoScroll]);

  function handleScroll() {
    const el = logContainerRef.current;
    if (!el) return;
    setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
  }

  function handleRetry() {
    if (pollRef.current) clearTimeout(pollRef.current);
    setRetryTick((t) => t + 1);
  }

  /* ── Automation handlers ────────────────────────────────────── */
  async function handleToggle() {
    if (!autoState || autoState.status === "killed") return;
    if (autoState.status !== "running" && !hasBothVenues) return;
    setToggling(true);
    setActionError(null);
    try {
      const action = autoState.status === "running" ? "pause" : "start";
      const result = await setAutomationStatus(action);
      if (result.error) throw new Error(result.error);
      if (result.data) setAutoState(result.data);
    } catch { setActionError("Failed to toggle automation"); }
    finally { setToggling(false); }
  }

  async function handleKill() {
    if (!killArmed) { setKillArmed(true); return; }
    setActionError(null);
    try {
      const result = await setAutomationStatus("kill", "Manual kill switch");
      if (result.error) throw new Error(result.error);
      if (result.data) setAutoState(result.data);
      setKillArmed(false);
    } catch { setActionError("Failed to trigger kill switch"); }
  }

  /* ── Derived state ──────────────────────────────────────────── */
  const h = health;
  const engineConnected = h != null && h.status !== "unreachable";
  const enginePaused = h?.paused === true;
  const isKilled = autoState?.status === "killed";
  const isRunning = autoState?.status === "running";
  const canStart = hasBothVenues && !isKilled;
  const guardPassCount = (d: Decision) => d.guard_results?.filter((g) => g.passed).length ?? 0;
  const guardTotalCount = (d: Decision) => d.guard_results?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* ══════════════════════════════════════════════════════════
          HERO: Engine Status + Automation Controls
          ══════════════════════════════════════════════════════════ */}
      {engineConnected ? (
        <div
          className={`rounded-xl border ${
            enginePaused
              ? "border-amber-400/20 bg-amber-400/5"
              : h.status === "ok"
                ? "border-emerald-400/20 bg-emerald-400/5"
                : "border-amber-400/20 bg-amber-400/5"
          } px-6 py-5`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`h-3 w-3 rounded-full animate-pulse ${
                enginePaused ? "bg-amber-400"
                  : h.status === "ok" ? "bg-emerald-400" : "bg-amber-400"
              }`} />
              <div>
                <h2 className={`text-lg font-semibold tracking-wide ${
                  enginePaused ? "text-amber-400"
                    : h.status === "ok" ? "text-emerald-400" : "text-amber-400"
                }`}>
                  {enginePaused ? "ENGINE PAUSED"
                    : h.status === "ok" ? "ENGINE CONNECTED"
                    : `ENGINE ${h.status?.toUpperCase()}`}
                </h2>
                <p className="mt-0.5 text-xs text-[#9ca3af]">
                  {wsCount(h)} WS feed{wsCount(h) !== 1 ? "s" : ""} active
                  {" \u00b7 "}{totalMarkets(h).toLocaleString()} markets
                  {" \u00b7 "}{h.xp_pairs ?? 0} pairs
                </p>
              </div>
            </div>

            {/* Automation controls inline */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleToggle}
                disabled={toggling || isKilled || (!isRunning && !canStart)}
                className={`rounded-lg px-5 py-2 text-xs font-semibold transition-colors ${
                  isKilled || (!isRunning && !canStart)
                    ? "cursor-not-allowed bg-[#1a1d21] text-[#9ca3af]"
                    : isRunning
                      ? "bg-amber-400/10 text-amber-400 hover:bg-amber-400/20"
                      : "bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20"
                }`}
              >
                {toggling ? "..." : isKilled ? "Killed" : isRunning ? "Pause" : !canStart ? "Configure Keys" : "Start"}
              </button>
              <button
                onClick={handleKill}
                disabled={isKilled}
                className={`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                  isKilled
                    ? "cursor-not-allowed bg-[#1a1d21] text-[#9ca3af]"
                    : killArmed
                      ? "animate-pulse bg-red-500 text-white ring-2 ring-red-400 ring-offset-2 ring-offset-[#050608]"
                      : "bg-red-400/10 text-red-400 hover:bg-red-400/20"
                }`}
              >
                {isKilled ? "Killed" : killArmed ? "Confirm Kill" : "Kill"}
              </button>
            </div>
          </div>

          {actionError && <p className="mt-2 text-xs text-red-400">{actionError}</p>}

          {/* Killed reason */}
          {isKilled && autoState?.killed_reason && (
            <div className="mt-3 rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-2 text-sm text-red-400">
              <span className="font-medium">Reason:</span> {autoState.killed_reason}
            </div>
          )}

          {/* Missing keys warning */}
          {!isRunning && !hasBothVenues && (
            <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/5 px-4 py-2">
              <p className="text-xs text-amber-400">
                {!hasKalshi && "Kalshi keys missing. "}{!hasPoly && "Polymarket keys missing. "}
                {onNavigate && (
                  <button onClick={() => onNavigate("connections")} className="underline hover:no-underline">
                    Go to Connections
                  </button>
                )}
              </p>
            </div>
          )}

          {/* Stale price warning */}
          {h.prices_stale && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="text-xs text-amber-400">
                Stale prices detected
                {h.oldest_kalshi_price_age_sec != null && h.oldest_kalshi_price_age_sec > 60 &&
                  ` \u00b7 Kalshi: ${Math.round(h.oldest_kalshi_price_age_sec)}s old`}
                {h.oldest_poly_price_age_sec != null && h.oldest_poly_price_age_sec > 60 &&
                  ` \u00b7 Poly: ${Math.round(h.oldest_poly_price_age_sec)}s old`}
              </span>
            </div>
          )}
        </div>
      ) : (
        /* ── Disconnected Banner ──────────────────────────────── */
        <div className="rounded-xl border border-red-400/20 bg-red-400/5 px-6 py-8">
          <div className="flex flex-col items-center text-center">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-400/10">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6 text-red-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" />
              </svg>
            </span>
            <h2 className="text-lg font-semibold text-red-400">ENGINE DISCONNECTED</h2>
            <p className="mt-2 max-w-md text-sm text-[#9ca3af]">
              The trading engine is not responding.
            </p>

            {/* Still show automation controls when disconnected */}
            {autoState && (
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={handleToggle}
                  disabled={toggling || isKilled || (!isRunning && !canStart)}
                  className={`rounded-lg px-5 py-2 text-xs font-semibold transition-colors ${
                    isKilled || (!isRunning && !canStart)
                      ? "cursor-not-allowed bg-[#1a1d21] text-[#9ca3af]"
                      : isRunning
                        ? "bg-amber-400/10 text-amber-400 hover:bg-amber-400/20"
                        : "bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20"
                  }`}
                >
                  {toggling ? "..." : isKilled ? "Killed" : isRunning ? "Pause" : !canStart ? "Configure Keys" : "Start"}
                </button>
                <button
                  onClick={handleKill}
                  disabled={isKilled}
                  className={`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                    isKilled
                      ? "cursor-not-allowed bg-[#1a1d21] text-[#9ca3af]"
                      : killArmed
                        ? "animate-pulse bg-red-500 text-white"
                        : "bg-red-400/10 text-red-400 hover:bg-red-400/20"
                  }`}
                >
                  {isKilled ? "Killed" : killArmed ? "Confirm Kill" : "Kill"}
                </button>
              </div>
            )}

            {actionError && <p className="mt-2 text-xs text-red-400">{actionError}</p>}

            <div className="mt-4 text-left text-xs text-[#3b3f46]">
              <p className="mb-1 font-medium text-[#9ca3af]">Troubleshooting:</p>
              <ul className="list-inside list-disc space-y-1">
                <li>Check that the daemon service is running on Railway</li>
                <li>Verify <code className="rounded bg-[#1a1d21] px-1 text-[#9ca3af]">WEBSOCKET_ENABLED=true</code> is set</li>
                <li>Check Railway logs for startup errors</li>
              </ul>
            </div>
            <button
              onClick={handleRetry}
              className="mt-5 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-400/20"
            >
              Retry Now
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          Detail Cards: WS Feeds + Markets + Pairs + Risk Metrics
          ══════════════════════════════════════════════════════════ */}
      {engineConnected && h && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card-panel rounded-xl p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#9ca3af]">WebSocket Feeds</p>
            <div className="mt-3 space-y-2">
              {[
                { label: "Kalshi", connected: h.kalshi_ws_connected, subs: h.kalshi_ws_subscriptions },
                { label: "Polymarket", connected: h.poly_ws_connected, subs: h.poly_ws_subscriptions },
                { label: "Poly US", connected: h.poly_us_ws_connected, subs: h.poly_us_ws_subscriptions },
              ].map((ws) => (
                <div key={ws.label} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2"><WsDot connected={ws.connected} /> {ws.label}</span>
                  <span className="font-mono text-[#9ca3af]">{ws.subs ?? 0}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card-panel rounded-xl p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#9ca3af]">Markets Tracked</p>
            <div className="mt-3 space-y-2 text-xs">
              {[
                { label: "Kalshi", count: h.kalshi_markets },
                { label: "Polymarket", count: h.poly_markets },
                { label: "Poly US", count: h.poly_us_markets },
              ].map((m) => (
                <div key={m.label} className="flex justify-between">
                  <span>{m.label}</span>
                  <span className="font-mono font-bold text-[#e8e9ea]">{(m.count ?? 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card-panel rounded-xl p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#9ca3af]">Active Pairs</p>
            <p className="mt-2 font-mono text-2xl font-bold text-[#e8e9ea]">{h.xp_pairs ?? 0}</p>
            <p className="mt-1 text-xs text-[#9ca3af]">+ {h.three_way_groups ?? 0} three-way groups</p>
          </div>

          <div className="card-panel rounded-xl p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#9ca3af]">Session Activity</p>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between"><span>Arb Checks</span><span className="font-mono font-bold text-[#e8e9ea]">{(h.arb_checks ?? 0).toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Signals</span><span className="font-mono font-bold text-blue-400">{h.signals_detected ?? 0}</span></div>
              <div className="flex justify-between"><span>Orders</span><span className="font-mono font-bold text-emerald-400">{h.orders_placed ?? 0}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          Risk Metrics (from automation state)
          ══════════════════════════════════════════════════════════ */}
      {autoState && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="card-panel rounded-xl p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#9ca3af]">Daily Loss</p>
            <p className="mt-2 font-mono text-xl font-bold">
              <span className={autoState.daily_loss_dollars > 0 ? "text-red-400" : "text-[#e8e9ea]"}>
                ${fmt(autoState.daily_loss_dollars)}
              </span>
            </p>
            {autoState.daily_loss_reset_at && (
              <p className="mt-1 text-[11px] text-[#9ca3af]">Resets {timeAgo(autoState.daily_loss_reset_at)}</p>
            )}
          </div>
          <div className="card-panel rounded-xl p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#9ca3af]">Max Drawdown</p>
            <p className="mt-2 font-mono text-xl font-bold">
              <span className={autoState.max_drawdown_dollars > 0 ? "text-red-400" : "text-[#e8e9ea]"}>
                ${fmt(autoState.max_drawdown_dollars)}
              </span>
            </p>
          </div>
          <div className="card-panel rounded-xl p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#9ca3af]">Peak Portfolio</p>
            <p className="mt-2 font-mono text-xl font-bold text-[#e8e9ea]">${fmt(autoState.peak_portfolio_value)}</p>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          Recent Candidates (decisions)
          ══════════════════════════════════════════════════════════ */}
      {decisions.length > 0 && (
        <div className="card-panel rounded-xl">
          <div className="border-b border-[#1a1d21] px-6 py-4">
            <h2 className="font-[family-name:var(--font-italiana)] text-base font-normal tracking-[0.04em] text-[#9ca3af]">
              Recent Candidates
            </h2>
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-[#9ca3af]">
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
                    <tr key={d.id} className="border-t border-[#1a1d21] transition-colors hover:bg-[#0a0d10]">
                      <td className="px-6 py-3 font-mono text-xs">{d.ticker}</td>
                      <td className="px-6 py-3">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          isPass ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"
                        }`}>{d.verdict.toUpperCase()}</span>
                      </td>
                      <td className="px-6 py-3 text-right font-mono text-xs">{d.edge_pct.toFixed(1)}%</td>
                      <td className="px-6 py-3 text-right font-mono text-xs">${fmt(d.suggested_size)}</td>
                      <td className="px-6 py-3 text-right">
                        <span className={`font-mono text-xs ${
                          guardPassCount(d) === guardTotalCount(d) ? "text-emerald-400" : "text-amber-400"
                        }`}>{guardPassCount(d)}/{guardTotalCount(d)}</span>
                      </td>
                      <td className="px-6 py-3 text-right text-xs text-[#9ca3af]">{timeAgo(d.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          Pipeline Log Stream
          ══════════════════════════════════════════════════════════ */}
      <div className="card-panel rounded-xl">
        <div className="flex items-center justify-between border-b border-[#1a1d21] px-6 py-4">
          <h2 className="font-[family-name:var(--font-italiana)] text-base font-normal tracking-[0.04em] text-[#9ca3af]">
            Pipeline Log
          </h2>
          <div className="flex items-center gap-3">
            {!autoScroll && (
              <button
                onClick={() => { setAutoScroll(true); logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }}
                className="rounded bg-[#1a1d21] px-2 py-1 text-[10px] text-[#9ca3af] transition-colors hover:text-[#e8e9ea]"
              >
                Scroll to bottom
              </button>
            )}
            <span className="text-[10px] text-[#3b3f46]">{logs.length} entries</span>
          </div>
        </div>

        <div ref={logContainerRef} onScroll={handleScroll} className="h-[400px] overflow-y-auto bg-[#050608] font-mono text-xs">
          {logs.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="text-sm text-[#9ca3af]">No log entries yet</p>
              <p className="mt-1 text-xs text-[#3b3f46]">Pipeline events will stream here when the engine is running.</p>
            </div>
          ) : (
            <div className="space-y-px p-3">
              {logs.map((log) => {
                const style = levelStyle(log.level);
                return (
                  <div key={log.id} className="group flex items-start gap-2 rounded px-2 py-1 transition-colors hover:bg-[#0a0d10]">
                    <span className="mt-1.5 shrink-0"><span className={`inline-block h-1.5 w-1.5 rounded-full ${style.dot}`} /></span>
                    <span className="shrink-0 text-[#3b3f46]">{fmtTime(log.created_at)}</span>
                    <span className={`shrink-0 rounded px-1 text-[10px] font-medium uppercase ${style.text}`}>{log.category}</span>
                    <span className="text-[#e8e9ea]">{log.message}</span>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <span className="hidden text-[#3b3f46] group-hover:inline">{JSON.stringify(log.details)}</span>
                    )}
                  </div>
                );
              })}
              <div ref={logEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
