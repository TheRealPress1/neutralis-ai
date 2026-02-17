"use client";

import { useEffect, useState } from "react";
import type { AuditLogEntry } from "@/types/api";
import { fetchAuditLogs, getTradesCsvUrl } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const EVENT_TYPES = [
  "All",
  "signal_generated",
  "risk_decision",
  "fill_recorded",
  "position_opened",
  "position_closed",
  "kill_switch_triggered",
  "automation_started",
  "automation_paused",
  "profile_changed",
  "settlement",
  "pipeline_run_complete",
] as const;

const ENTITY_TYPES = [
  "All",
  "signal",
  "decision",
  "trade",
  "position",
  "automation",
  "profile",
] as const;

const EVENT_COLOR_MAP: Record<string, { bg: string; text: string }> = {
  signal_generated:     { bg: "bg-blue-400/10",    text: "text-blue-400" },
  risk_decision:        { bg: "bg-amber-400/10",   text: "text-amber-400" },
  fill_recorded:        { bg: "bg-emerald-400/10", text: "text-emerald-400" },
  position_opened:      { bg: "bg-emerald-400/10", text: "text-emerald-400" },
  position_closed:      { bg: "bg-purple-400/10",  text: "text-purple-400" },
  settlement:           { bg: "bg-purple-400/10",  text: "text-purple-400" },
  kill_switch_triggered:{ bg: "bg-red-400/10",     text: "text-red-400" },
  automation_started:   { bg: "bg-cyan-400/10",    text: "text-cyan-400" },
  automation_paused:    { bg: "bg-cyan-400/10",    text: "text-cyan-400" },
  profile_changed:      { bg: "bg-gray-400/10",    text: "text-gray-400" },
  profile_activated:    { bg: "bg-gray-400/10",    text: "text-gray-400" },
  pipeline_run_complete:{ bg: "bg-indigo-400/10",  text: "text-indigo-400" },
};

const DEFAULT_COLOR = { bg: "bg-gray-400/10", text: "text-gray-400" };

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function eventColor(eventType: string) {
  return EVENT_COLOR_MAP[eventType] ?? DEFAULT_COLOR;
}

/** Build a short human-readable summary from the details object. */
function summarize(details: Record<string, unknown>): string {
  const parts: string[] = [];

  if (details.ticker)      parts.push(String(details.ticker));
  if (details.signal_type) parts.push(String(details.signal_type));
  if (details.verdict)     parts.push(`verdict: ${details.verdict}`);
  if (details.reason)      parts.push(String(details.reason));

  if (typeof details.edge_pct === "number") {
    parts.push(`edge ${(details.edge_pct as number * 100).toFixed(1)}%`);
  }
  if (typeof details.size_dollars === "number") {
    parts.push(`$${(details.size_dollars as number).toFixed(2)}`);
  }
  if (typeof details.realized_pnl === "number") {
    parts.push(`pnl $${(details.realized_pnl as number).toFixed(2)}`);
  }

  return parts.length > 0 ? parts.join(" \u00b7 ") : "\u2014";
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ActivityLog({ refreshKey }: { refreshKey: number }) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [eventFilter, setEventFilter] = useState<string>("All");
  const [entityFilter, setEntityFilter] = useState<string>("All");

  /* Fetch logs whenever filters or refreshKey change */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params: { event_type?: string; entity_type?: string; limit?: number } = {
      limit: 100,
    };
    if (eventFilter !== "All")  params.event_type  = eventFilter;
    if (entityFilter !== "All") params.entity_type = entityFilter;

    fetchAuditLogs(params)
      .then((data) => {
        if (!cancelled) setLogs(data);
      })
      .catch(() => {
        if (!cancelled) setLogs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey, eventFilter, entityFilter]);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="card-panel rounded-xl">
      {/* ---------- Filter bar ---------- */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#1a1d21] px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#9ca3af]">
          Activity Log
        </h2>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Event type filter */}
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="rounded border border-[#1a1d21] bg-[#050608] px-2.5 py-1.5 text-xs text-[#e8e9ea] outline-none focus:border-[#3b3f46]"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t === "All" ? "All Events" : t}
              </option>
            ))}
          </select>

          {/* Entity type filter */}
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="rounded border border-[#1a1d21] bg-[#050608] px-2.5 py-1.5 text-xs text-[#e8e9ea] outline-none focus:border-[#3b3f46]"
          >
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t === "All" ? "All Entities" : t}
              </option>
            ))}
          </select>

          {/* CSV export button */}
          <a
            href={getTradesCsvUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded border border-[#1a1d21] bg-[#050608] px-3 py-1.5 text-xs font-medium text-[#9ca3af] transition-colors hover:border-[#3b3f46] hover:text-[#e8e9ea]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-3.5 w-3.5"
            >
              <path
                fillRule="evenodd"
                d="M10 3a.75.75 0 0 1 .75.75v6.19l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 1 1 1.06-1.06l2.22 2.22V3.75A.75.75 0 0 1 10 3Zm-5.5 9.75a.75.75 0 0 0-1.5 0v.5A2.75 2.75 0 0 0 5.75 16h8.5A2.75 2.75 0 0 0 17 13.25v-.5a.75.75 0 0 0-1.5 0v.5c0 .69-.56 1.25-1.25 1.25h-8.5c-.69 0-1.25-.56-1.25-1.25v-.5Z"
                clipRule="evenodd"
              />
            </svg>
            Export CSV
          </a>
        </div>
      </div>

      {/* ---------- Log entries ---------- */}
      <div className="max-h-[600px] overflow-y-auto">
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded bg-[#0a0d10]"
              />
            ))}
          </div>
        ) : logs.length === 0 ? (
          /* ---------- Empty state ---------- */
          <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="mb-3 h-10 w-10 text-[#3b3f46]"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
              />
            </svg>
            <p className="text-sm text-[#9ca3af]">No audit log entries found</p>
            <p className="mt-1 text-xs text-[#3b3f46]">
              Activity will appear here as the system processes events.
            </p>
          </div>
        ) : (
          <ul>
            {logs.map((entry) => {
              const color = eventColor(entry.event_type);
              const expanded = expandedId === entry.id;

              return (
                <li
                  key={entry.id}
                  className="border-t border-[#1a1d21]"
                >
                  <button
                    onClick={() =>
                      setExpandedId(expanded ? null : entry.id)
                    }
                    className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-[#0a0d10]/60"
                  >
                    {/* Dot indicator */}
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${color.text.replace("text-", "bg-")}`}
                    />

                    <div className="min-w-0 flex-1">
                      {/* Top row: badge + entity info + timestamp */}
                      <div className="flex items-center gap-2">
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${color.bg} ${color.text}`}
                        >
                          {entry.event_type}
                        </span>

                        {entry.entity_type && (
                          <span className="rounded border border-[#1a1d21] bg-[#0a0d10] px-1.5 py-0.5 text-[10px] uppercase text-[#9ca3af]">
                            {entry.entity_type}
                          </span>
                        )}

                        {entry.entity_id && (
                          <span className="truncate font-mono text-xs text-[#9ca3af]">
                            {entry.entity_id}
                          </span>
                        )}

                        <span className="ml-auto shrink-0 text-xs text-[#3b3f46]">
                          {timeAgo(entry.created_at)}
                        </span>

                        <span className="shrink-0 text-[10px] text-[#3b3f46]">
                          {expanded ? "\u25B2" : "\u25BC"}
                        </span>
                      </div>

                      {/* Summary line */}
                      <p className="mt-1 truncate text-xs text-[#9ca3af]">
                        {summarize(entry.details)}
                      </p>
                    </div>
                  </button>

                  {/* Expanded details (full JSON) */}
                  {expanded && (
                    <div className="mx-5 mb-3 rounded border border-[#1a1d21] bg-[#050608] p-3">
                      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-[#9ca3af]">
                        {JSON.stringify(entry.details, null, 2)}
                      </pre>
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
