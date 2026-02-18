"use client";

import { useEffect, useState, useCallback } from "react";
import type { Order, Fill } from "@/types/api";
import { fetchOrders, fetchFillsForOrder } from "@/lib/api";
import DecisionReasonDrawer from "./DecisionReasonDrawer";

function fmt(n: number, d = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    filled: "bg-emerald-400/10 text-emerald-400",
    partial: "bg-amber-400/10 text-amber-400",
    cancelled: "bg-red-400/10 text-red-400",
    pending: "bg-[#1a1d21] text-[#9ca3af]",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${styles[status] ?? styles.pending}`}>
      {status}
    </span>
  );
}

type FilterTab = "all" | "filled" | "partial" | "cancelled";

export default function OrdersTable({ refreshKey }: { refreshKey: number }) {
  const [tab, setTab] = useState<FilterTab>("all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fills, setFills] = useState<Fill[]>([]);
  const [drawerDecisionId, setDrawerDecisionId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    function load() {
      setLoading(true);
      const status = tab === "all" ? undefined : tab;
      fetchOrders(50, status)
        .then((d) => { if (!cancelled) setOrders(d); })
        .catch(() => { if (!cancelled) setOrders([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }
    load();
    return () => { cancelled = true; };
  }, [refreshKey, tab]);

  const toggleExpand = useCallback((orderId: string) => {
    if (expandedId === orderId) {
      setExpandedId(null);
      setFills([]);
    } else {
      setExpandedId(orderId);
      fetchFillsForOrder(orderId)
        .then(setFills)
        .catch(() => setFills([]));
    }
  }, [expandedId]);

  const tabs: FilterTab[] = ["all", "filled", "partial", "cancelled"];

  return (
    <>
      <div className="card-panel rounded-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1a1d21] px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#9ca3af]">
            Orders
          </h2>
          <div className="flex gap-1">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  tab === t
                    ? "bg-[#1a1d21] text-[#e8e9ea]"
                    : "text-[#9ca3af] hover:text-[#e8e9ea]"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-[#9ca3af]">
                <th className="px-5 py-3 font-medium">Ticker</th>
                <th className="px-5 py-3 font-medium">Venue</th>
                <th className="px-5 py-3 font-medium">Side</th>
                <th className="px-5 py-3 font-medium text-right">Req Price</th>
                <th className="px-5 py-3 font-medium text-right">Avg Fill</th>
                <th className="px-5 py-3 font-medium text-right">Fill%</th>
                <th className="px-5 py-3 font-medium text-right">Slip (bps)</th>
                <th className="px-5 py-3 font-medium text-right">Fees</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-t border-[#1a1d21]">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="px-5 py-3">
                        <div className="h-4 w-16 animate-pulse rounded bg-[#0a0d10]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-10 text-center text-[#9ca3af]">
                    No orders
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  const fillPct = o.requested_size_dollars > 0
                    ? (o.filled_size_dollars / o.requested_size_dollars * 100)
                    : 0;
                  return (
                    <tr
                      key={o.id}
                      className="cursor-pointer border-t border-[#1a1d21] transition-colors hover:bg-[#0d1014]"
                      onClick={() => toggleExpand(o.id)}
                    >
                      <td className="px-5 py-3">
                        <span className="font-mono text-xs">{o.ticker}</span>
                        <button
                          className="ml-2 text-[10px] text-blue-400 hover:underline"
                          onClick={(e) => { e.stopPropagation(); setDrawerDecisionId(o.decision_id); }}
                        >
                          D#{o.decision_id}
                        </button>
                      </td>
                      <td className="px-5 py-3">
                        <span className="rounded border border-[#1a1d21] bg-[#0a0d10] px-2 py-0.5 text-xs uppercase">
                          {o.venue}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={o.side === "buy_yes" ? "text-emerald-400" : "text-red-400"}>
                          {o.side === "buy_yes" ? "YES" : "NO"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-mono">${fmt(o.requested_price, 4)}</td>
                      <td className="px-5 py-3 text-right font-mono">
                        {o.avg_fill_price !== null ? `$${fmt(o.avg_fill_price, 4)}` : "-"}
                      </td>
                      <td className="px-5 py-3 text-right font-mono">{fmt(fillPct, 0)}%</td>
                      <td className="px-5 py-3 text-right font-mono">
                        {o.slippage_bps !== null ? (
                          <span className={
                            o.slippage_bps < 10 ? "text-emerald-400"
                            : o.slippage_bps <= 50 ? "text-amber-400"
                            : "text-red-400"
                          }>
                            {fmt(o.slippage_bps, 1)}
                          </span>
                        ) : "-"}
                      </td>
                      <td className="px-5 py-3 text-right font-mono">${fmt(o.fees_dollars, 4)}</td>
                      <td className="px-5 py-3"><StatusBadge status={o.status} /></td>
                      <td className="px-5 py-3 text-right text-xs text-[#9ca3af]">
                        {timeAgo(o.created_at)}
                      </td>
                    </tr>
                  );
                })
              )}

              {/* Expanded fills row */}
              {expandedId && fills.length > 0 && (
                <tr className="border-t border-[#1a1d21] bg-[#050608]">
                  <td colSpan={10} className="px-5 py-3">
                    <div className="text-xs text-[#9ca3af] mb-2 uppercase tracking-wider font-medium">
                      Fills for {expandedId}
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[#9ca3af]">
                          <th className="py-1 text-left font-medium">#</th>
                          <th className="py-1 text-right font-medium">Price</th>
                          <th className="py-1 text-right font-medium">Qty</th>
                          <th className="py-1 text-right font-medium">Size$</th>
                          <th className="py-1 text-right font-medium">Fee$</th>
                          <th className="py-1 text-right font-medium">Slip (bps)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fills.map((f) => (
                          <tr key={f.id} className="border-t border-[#1a1d21]/50">
                            <td className="py-1 font-mono">{f.fill_number}</td>
                            <td className="py-1 text-right font-mono">${fmt(f.price, 4)}</td>
                            <td className="py-1 text-right font-mono">{fmt(f.quantity, 2)}</td>
                            <td className="py-1 text-right font-mono">${fmt(f.size_dollars)}</td>
                            <td className="py-1 text-right font-mono">${fmt(f.fee_dollars, 4)}</td>
                            <td className="py-1 text-right font-mono">
                              <span className={
                                f.slippage_bps < 10 ? "text-emerald-400"
                                : f.slippage_bps <= 50 ? "text-amber-400"
                                : "text-red-400"
                              }>
                                {fmt(f.slippage_bps, 1)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Decision reasons drawer */}
      {drawerDecisionId !== null && (
        <DecisionReasonDrawer
          decisionId={drawerDecisionId}
          onClose={() => setDrawerDecisionId(null)}
        />
      )}
    </>
  );
}
