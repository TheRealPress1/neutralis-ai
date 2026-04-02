"use client";

import { useEffect, useState } from "react";
import type { Signal, Decision, Order, Fill, Position, TimelineItem } from "@/types/api";
import {
  fetchSignals,
  fetchDecisions,
  fetchOrders,
  fetchFills,
  fetchPositions,
} from "@/lib/api";

/* ── Constants ─────────────────────────────────────────────────────── */

const KINDS = ["all", "signal", "decision", "order", "fill", "position"] as const;
type KindFilter = (typeof KINDS)[number];

const KIND_STYLE: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  signal:   { bg: "bg-blue-400/10",    text: "text-blue-400",    dot: "bg-blue-400",    label: "Signal" },
  decision: { bg: "bg-amber-400/10",   text: "text-amber-400",   dot: "bg-amber-400",   label: "Decision" },
  order:    { bg: "bg-emerald-400/10", text: "text-emerald-400", dot: "bg-emerald-400", label: "Order" },
  fill:     { bg: "bg-green-400/10",   text: "text-green-400",   dot: "bg-green-400",   label: "Fill" },
  position: { bg: "bg-purple-400/10",  text: "text-purple-400",  dot: "bg-purple-400",  label: "Position" },
};

/* ── Helpers ───────────────────────────────────────────────────────── */

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

function buildTimeline(
  signals: Signal[],
  decisions: Decision[],
  orders: Order[],
  fills: Fill[],
  positions: Position[],
): TimelineItem[] {
  const items: TimelineItem[] = [
    ...signals.map((d) => ({ kind: "signal" as const, data: d, ts: d.created_at })),
    ...decisions.map((d) => ({ kind: "decision" as const, data: d, ts: d.created_at })),
    ...orders.map((d) => ({ kind: "order" as const, data: d, ts: d.created_at })),
    ...fills.map((d) => ({ kind: "fill" as const, data: d, ts: d.created_at })),
    ...positions.map((d) => ({ kind: "position" as const, data: d, ts: d.opened_at })),
  ];
  items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  return items;
}

/* ── Summary renderers per kind ────────────────────────────────────── */

function SignalSummary({ d }: { d: Signal }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="font-mono text-xs text-[#e8e9ea]">{d.ticker}</span>
      <span className="text-[10px] text-[#9ca3af]">{d.signal_type.replace(/_/g, " ")}</span>
      {d.edge_pct > 0 && (
        <span className="text-[10px] text-blue-400">edge {d.edge_pct.toFixed(1)}%</span>
      )}
      {d.net_edge > 0 && (
        <span className="text-[10px] text-[#9ca3af]">net ${fmt(d.net_edge, 4)}</span>
      )}
    </div>
  );
}

function DecisionSummary({ d }: { d: Decision }) {
  const pass = d.verdict === "pass";
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="font-mono text-xs text-[#e8e9ea]">{d.ticker}</span>
      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
        pass ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"
      }`}>
        {d.verdict.toUpperCase()}
      </span>
      {d.edge_pct > 0 && (
        <span className="text-[10px] text-[#9ca3af]">edge {d.edge_pct.toFixed(1)}%</span>
      )}
      {pass && d.suggested_size > 0 && (
        <span className="text-[10px] text-emerald-400">${fmt(d.suggested_size)}</span>
      )}
    </div>
  );
}

function OrderSummary({ d }: { d: Order }) {
  const statusColor = d.status === "filled" ? "text-emerald-400"
    : d.status === "partial" ? "text-amber-400"
    : d.status === "cancelled" ? "text-red-400"
    : "text-[#9ca3af]";
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="font-mono text-xs text-[#e8e9ea]">{d.ticker}</span>
      <span className={`text-[10px] font-medium ${statusColor}`}>{d.status}</span>
      <span className="text-[10px] text-[#9ca3af]">{d.side.replace("_", " ")}</span>
      <span className="text-[10px] text-[#9ca3af]">${fmt(d.requested_size_dollars)}</span>
      {d.venue && (
        <span className="rounded border border-[#1a1d21] px-1 py-0.5 text-[10px] text-[#3b3f46]">{d.venue}</span>
      )}
    </div>
  );
}

function FillSummary({ d }: { d: Fill }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {d.ticker && <span className="font-mono text-xs text-[#e8e9ea]">{d.ticker}</span>}
      <span className="text-[10px] text-[#9ca3af]">qty {d.quantity}</span>
      <span className="text-[10px] text-[#9ca3af]">@ {(d.price * 100).toFixed(0)}c</span>
      <span className="text-[10px] text-[#9ca3af]">${fmt(d.size_dollars)}</span>
      {d.slippage_bps !== 0 && (
        <span className={`text-[10px] ${d.slippage_bps > 0 ? "text-red-400" : "text-emerald-400"}`}>
          {d.slippage_bps > 0 ? "+" : ""}{d.slippage_bps.toFixed(0)}bps slip
        </span>
      )}
    </div>
  );
}

function PositionSummary({ d }: { d: Position }) {
  const closed = d.status === "closed";
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="font-mono text-xs text-[#e8e9ea]">{d.ticker}</span>
      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
        closed ? "bg-[#1a1d21] text-[#9ca3af]" : "bg-purple-400/10 text-purple-400"
      }`}>
        {closed ? "CLOSED" : "OPEN"}
      </span>
      <span className="text-[10px] text-[#9ca3af]">{d.side.replace("_", " ")}</span>
      <span className="text-[10px] text-[#9ca3af]">${fmt(d.size_dollars)}</span>
      {closed && (
        <span className={`text-[10px] font-medium ${d.realized_pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          P&L ${d.realized_pnl >= 0 ? "+" : ""}{fmt(d.realized_pnl)}
        </span>
      )}
      {!closed && d.unrealized_pnl !== 0 && (
        <span className={`text-[10px] ${d.unrealized_pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          unreal ${d.unrealized_pnl >= 0 ? "+" : ""}{fmt(d.unrealized_pnl)}
        </span>
      )}
    </div>
  );
}

function ItemSummary({ item }: { item: TimelineItem }) {
  switch (item.kind) {
    case "signal":   return <SignalSummary d={item.data} />;
    case "decision": return <DecisionSummary d={item.data} />;
    case "order":    return <OrderSummary d={item.data} />;
    case "fill":     return <FillSummary d={item.data} />;
    case "position": return <PositionSummary d={item.data} />;
  }
}

/* ── Expandable detail per kind ────────────────────────────────────── */

function ItemDetail({ item }: { item: TimelineItem }) {
  if (item.kind === "decision") {
    const d = item.data;
    if (!d.guard_results || d.guard_results.length === 0) return null;
    return (
      <div className="mt-2 space-y-1">
        {d.guard_results.map((g, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px]">
            <span className={`h-1.5 w-1.5 rounded-full ${g.passed ? "bg-emerald-400" : "bg-red-400"}`} />
            <span className="text-[#9ca3af]">{g.guard_name}</span>
            {g.value !== null && g.threshold !== null && (
              <span className="font-mono text-[#3b3f46]">
                {g.value.toFixed(2)} / {g.threshold.toFixed(2)}
              </span>
            )}
            {!g.passed && g.reason && (
              <span className="text-red-400/70">{g.reason}</span>
            )}
          </div>
        ))}
      </div>
    );
  }
  // For other kinds, show raw data
  return (
    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-[#9ca3af]">
      {JSON.stringify(item.data, null, 2)}
    </pre>
  );
}

/* ── Main Component ────────────────────────────────────────────────── */

export default function ActivityTimeline({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<KindFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      fetchSignals(50),
      fetchDecisions(50),
      fetchOrders(50),
      fetchFills(50),
      fetchPositions("open", 25),
      fetchPositions("closed", 25),
    ])
      .then(([signals, decisions, orders, fills, open, closed]) => {
        if (cancelled) return;
        setItems(buildTimeline(signals, decisions, orders, fills, [...open, ...closed]));
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [refreshKey]);

  const filtered = filter === "all" ? items : items.filter((i) => i.kind === filter);

  // Build a unique key for each item
  function itemKey(item: TimelineItem) {
    return `${item.kind}-${"id" in item.data ? item.data.id : item.ts}`;
  }

  return (
    <div className="card-panel rounded-xl">
      {/* Header + Filter */}
      <div className="border-b border-[#1a1d21] px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-[family-name:var(--font-italiana)] text-xl font-normal tracking-[0.04em]">
            Activity
          </h2>
          <div className="flex items-center gap-1">
            {KINDS.map((k) => {
              const style = k === "all" ? null : KIND_STYLE[k];
              const count = k === "all" ? items.length : items.filter((i) => i.kind === k).length;
              return (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={`rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors ${
                    filter === k
                      ? "bg-[#1a1d21] text-[#e8e9ea]"
                      : "text-[#9ca3af] hover:text-[#e8e9ea]"
                  }`}
                >
                  {k === "all" ? "All" : style?.label ?? k}
                  {count > 0 && (
                    <span className="ml-1 text-[#3b3f46]">{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="max-h-[680px] overflow-y-auto">
        {loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-[#12151a]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mb-3 h-10 w-10 text-[#3b3f46]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <p className="text-sm text-[#9ca3af]">No activity yet</p>
            <p className="mt-1 text-xs text-[#3b3f46]">
              Signals, decisions, orders, and positions will appear here as the engine runs.
            </p>
          </div>
        ) : (
          <ul>
            {filtered.map((item) => {
              const key = itemKey(item);
              const style = KIND_STYLE[item.kind];
              const expanded = expandedId === key;

              return (
                <li key={key} className="border-t border-[#1a1d21]">
                  <button
                    onClick={() => setExpandedId(expanded ? null : key)}
                    className="flex w-full items-start gap-3 px-6 py-3 text-left transition-colors hover:bg-[#0a0d10]/60"
                  >
                    {/* Timeline dot */}
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`} />

                    <div className="min-w-0 flex-1">
                      {/* Type badge + timestamp */}
                      <div className="flex items-center gap-2">
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${style.bg} ${style.text}`}>
                          {style.label}
                        </span>
                        <span className="ml-auto shrink-0 text-xs text-[#3b3f46]">
                          {timeAgo(item.ts)}
                        </span>
                        <span className="shrink-0 text-[10px] text-[#3b3f46]">
                          {expanded ? "\u25B2" : "\u25BC"}
                        </span>
                      </div>

                      {/* Summary line */}
                      <div className="mt-1">
                        <ItemSummary item={item} />
                      </div>
                    </div>
                  </button>

                  {/* Expanded details */}
                  {expanded && (
                    <div className="mx-6 mb-3 rounded border border-[#1a1d21] bg-[#050608] p-3">
                      <ItemDetail item={item} />
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
