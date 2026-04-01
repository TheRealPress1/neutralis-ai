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

/* ── Component ───────────────────────────────────────────────────── */

export default function LivePanel({ refreshKey }: { refreshKey: number }) {
  const [health, setHealth] = useState<EngineHealth | null>(null);
  const [logs, setLogs] = useState<PipelineLog[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Fetch engine health with exponential backoff when unreachable
  useEffect(() => {
    let cancelled = false;
    let delay = 5_000;
    let timer: ReturnType<typeof setTimeout>;
    function poll() {
      fetchEngineHealth()
        .then((h) => {
          if (cancelled) return;
          setHealth(h);
          // Reset to 5s on success, back off on unreachable
          delay = h.status === "unreachable" ? Math.min(delay * 1.5, 30_000) : 5_000;
        })
        .catch(() => {
          delay = Math.min(delay * 1.5, 30_000);
        })
        .finally(() => {
          if (!cancelled) timer = setTimeout(poll, delay);
        });
    }
    poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

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

  // Detect user scroll-up to pause auto-scroll
  function handleScroll() {
    const el = logContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  }

  const h = health;
  const statusColor =
    !h || h.status === "unreachable"
      ? "text-[#9ca3af]"
      : h.status === "ok"
        ? "text-emerald-400"
        : h.status === "degraded"
          ? "text-amber-400"
          : "text-red-400";

  return (
    <div className="space-y-6">
      {/* ── Engine Health ───────────────────────────────────────── */}
      <div className="card-panel rounded-xl">
        <div className="border-b border-[#1a1d21] px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-italiana)] text-xl font-normal tracking-[0.04em]">
              Engine Status
            </h2>
            <span className={`text-sm font-semibold uppercase ${statusColor}`}>
              {h?.status ?? "Connecting..."}
            </span>
          </div>
        </div>

        {h && h.status !== "unreachable" ? (
          <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* WebSocket Connections */}
            <div className="rounded-lg border border-[#1a1d21] bg-[#050608] p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-[#9ca3af]">
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
            <div className="rounded-lg border border-[#1a1d21] bg-[#050608] p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-[#9ca3af]">
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
            <div className="rounded-lg border border-[#1a1d21] bg-[#050608] p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-[#9ca3af]">
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
            <div className="rounded-lg border border-[#1a1d21] bg-[#050608] p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-[#9ca3af]">
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
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mb-3 h-10 w-10 text-[#2a2d31]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" />
            </svg>
            <p className="text-sm text-[#9ca3af]">Engine unreachable</p>
            <p className="mt-1 max-w-xs text-xs text-[#3b3f46]">
              The trading engine is not currently running or is not reachable. Start the backend daemon to see live status.
            </p>
          </div>
        )}
      </div>

      {/* ── Log Stream ──────────────────────────────────────────── */}
      <div className="card-panel rounded-xl">
        <div className="flex items-center justify-between border-b border-[#1a1d21] px-6 py-4">
          <h2 className="font-[family-name:var(--font-cormorant)] text-base font-medium tracking-wide text-[#9ca3af]">
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
