"use client";

import { useEffect, useRef, useState } from "react";
import type { PipelineLog, EngineHealth } from "@/types/api";
import { fetchPipelineLogs, fetchEngineHealth } from "@/lib/api";
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
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function WsDot({ connected }: { connected?: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${
        connected ? "bg-emerald-400" : "bg-red-400"
      }`}
    />
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

export default function LivePanel({ refreshKey }: { refreshKey: number }) {
  const [health, setHealth] = useState<EngineHealth | null>(null);
  const [logs, setLogs] = useState<PipelineLog[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  // Manual retry trigger
  const [retryTick, setRetryTick] = useState(0);

  // Fetch engine health with exponential backoff
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
        .catch(() => {
          delay = Math.min(delay * 1.5, 30_000);
        })
        .finally(() => {
          if (!cancelledRef.current) pollRef.current = setTimeout(poll, delay);
        });
    }
    poll();
    return () => {
      cancelledRef.current = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [retryTick]);

  // Initial log fetch
  useEffect(() => {
    fetchPipelineLogs(200)
      .then((data) => setLogs(data.reverse()))
      .catch(() => {});
  }, [refreshKey]);

  // Realtime subscription for new logs
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function subscribe() {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;

      const channel = supabase
        .channel("pipeline-logs-live")
        .on(
          "postgres_changes" as any,
          {
            event: "INSERT",
            schema: "public",
            table: "pipeline_logs",
            filter: `user_id=eq.${user.id}`,
          },
          (payload: any) => {
            const newLog = payload.new as PipelineLog;
            setLogs((prev) => [...prev.slice(-499), newLog]);
          },
        )
        .subscribe();

      channelRef.current = channel;
    }

    subscribe();
    return () => {
      cancelled = true;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  function handleScroll() {
    const el = logContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  }

  function handleRetry() {
    if (pollRef.current) clearTimeout(pollRef.current);
    setRetryTick((t) => t + 1);
  }

  const h = health;
  const connected = h != null && h.status !== "unreachable";
  const paused = h?.paused === true;

  return (
    <div className="space-y-6">
      {/* ── Hero Engine Status Banner ──────────────────────────── */}
      {connected ? (
        <div
          className={`rounded-xl border ${
            paused
              ? "border-amber-400/20 bg-amber-400/5"
              : h.status === "ok"
                ? "border-emerald-400/20 bg-emerald-400/5"
                : "border-amber-400/20 bg-amber-400/5"
          } px-6 py-5`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className={`h-3 w-3 rounded-full ${
                  paused
                    ? "bg-amber-400 animate-pulse"
                    : h.status === "ok"
                      ? "bg-emerald-400 animate-pulse"
                      : "bg-amber-400 animate-pulse"
                }`}
              />
              <div>
                <h2
                  className={`text-lg font-semibold tracking-wide ${
                    paused
                      ? "text-amber-400"
                      : h.status === "ok"
                        ? "text-emerald-400"
                        : "text-amber-400"
                  }`}
                >
                  {paused
                    ? "ENGINE PAUSED"
                    : h.status === "ok"
                      ? "ENGINE CONNECTED"
                      : `ENGINE ${h.status?.toUpperCase()}`}
                </h2>
                <p className="mt-0.5 text-xs text-[#9ca3af]">
                  {wsCount(h)} WS feed{wsCount(h) !== 1 ? "s" : ""} active
                  {" \u00b7 "}
                  {totalMarkets(h).toLocaleString()} markets tracked
                  {" \u00b7 "}
                  {h.xp_pairs ?? 0} cross-platform pairs
                </p>
              </div>
            </div>
            <span className="rounded-md bg-[#1a1d21] px-3 py-1.5 text-xs font-medium text-[#9ca3af]">
              {h.status?.toUpperCase()}
            </span>
          </div>

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
              The trading engine is not responding. This could mean the daemon is not running or the network is unreachable.
            </p>
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

      {/* ── Detail Cards (only when connected) ─────────────────── */}
      {connected && h && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* WebSocket Connections */}
          <div className="card-panel rounded-xl p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#9ca3af]">
              WebSocket Feeds
            </p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <WsDot connected={h.kalshi_ws_connected} /> Kalshi
                </span>
                <span className="font-mono text-[#9ca3af]">
                  {h.kalshi_ws_subscriptions ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <WsDot connected={h.poly_ws_connected} /> Polymarket
                </span>
                <span className="font-mono text-[#9ca3af]">
                  {h.poly_ws_subscriptions ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <WsDot connected={h.poly_us_ws_connected} /> Poly US
                </span>
                <span className="font-mono text-[#9ca3af]">
                  {h.poly_us_ws_subscriptions ?? 0}
                </span>
              </div>
            </div>
          </div>

          {/* Market Coverage */}
          <div className="card-panel rounded-xl p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#9ca3af]">
              Markets Tracked
            </p>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span>Kalshi</span>
                <span className="font-mono font-bold text-[#e8e9ea]">
                  {(h.kalshi_markets ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Polymarket</span>
                <span className="font-mono font-bold text-[#e8e9ea]">
                  {(h.poly_markets ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Poly US</span>
                <span className="font-mono font-bold text-[#e8e9ea]">
                  {(h.poly_us_markets ?? 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Pairs & Groups */}
          <div className="card-panel rounded-xl p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#9ca3af]">
              Active Pairs
            </p>
            <p className="mt-2 font-mono text-2xl font-bold text-[#e8e9ea]">
              {h.xp_pairs ?? 0}
            </p>
            <p className="mt-1 text-xs text-[#9ca3af]">
              + {h.three_way_groups ?? 0} three-way groups
            </p>
          </div>

          {/* Signal Activity */}
          <div className="card-panel rounded-xl p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#9ca3af]">
              Session Activity
            </p>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span>Arb Checks</span>
                <span className="font-mono font-bold text-[#e8e9ea]">
                  {(h.arb_checks ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Signals</span>
                <span className="font-mono font-bold text-blue-400">
                  {h.signals_detected ?? 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Orders</span>
                <span className="font-mono font-bold text-emerald-400">
                  {h.orders_placed ?? 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Log Stream ──────────────────────────────────────────── */}
      <div className="card-panel rounded-xl">
        <div className="flex items-center justify-between border-b border-[#1a1d21] px-6 py-4">
          <h2 className="font-[family-name:var(--font-italiana)] text-base font-normal tracking-[0.04em] text-[#9ca3af]">
            Pipeline Log
          </h2>
          <div className="flex items-center gap-3">
            {!autoScroll && (
              <button
                onClick={() => {
                  setAutoScroll(true);
                  logEndRef.current?.scrollIntoView({ behavior: "smooth" });
                }}
                className="rounded bg-[#1a1d21] px-2 py-1 text-[10px] text-[#9ca3af] transition-colors hover:text-[#e8e9ea]"
              >
                Scroll to bottom
              </button>
            )}
            <span className="text-[10px] text-[#3b3f46]">
              {logs.length} entries
            </span>
          </div>
        </div>

        <div
          ref={logContainerRef}
          onScroll={handleScroll}
          className="h-[400px] overflow-y-auto bg-[#050608] font-mono text-xs"
        >
          {logs.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="text-sm text-[#9ca3af]">No log entries yet</p>
              <p className="mt-1 text-xs text-[#3b3f46]">
                Pipeline events will stream here when the engine is running.
              </p>
            </div>
          ) : (
            <div className="space-y-px p-3">
              {logs.map((log) => {
                const style = levelStyle(log.level);
                return (
                  <div
                    key={log.id}
                    className="group flex items-start gap-2 rounded px-2 py-1 transition-colors hover:bg-[#0a0d10]"
                  >
                    <span className="mt-1.5 shrink-0">
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${style.dot}`} />
                    </span>
                    <span className="shrink-0 text-[#3b3f46]">
                      {fmtTime(log.created_at)}
                    </span>
                    <span
                      className={`shrink-0 rounded px-1 text-[10px] font-medium uppercase ${style.text}`}
                    >
                      {log.category}
                    </span>
                    <span className="text-[#e8e9ea]">{log.message}</span>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <span className="hidden text-[#3b3f46] group-hover:inline">
                        {JSON.stringify(log.details)}
                      </span>
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
