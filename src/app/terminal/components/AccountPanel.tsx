"use client";

import Link from "next/link";
import { useState } from "react";
import type { OrderCancelResponse, TerminalAccount } from "@/lib/terminal/trading-types";
import { terminalRequest } from "./useTerminalData";
import { cents, contracts, dateTime, dollars } from "./format";
import styles from "./TerminalWorkspace.module.css";

export default function AccountPanel({ account, signedIn, loading, error, refresh, onSelect }: { account: TerminalAccount | null; signedIn: boolean; loading: boolean; error: string | null; refresh: () => void; onSelect: (ticker: string) => void }) {
  const [tab, setTab] = useState<"orders" | "positions" | "fills">("orders");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function cancel() {
    if (!cancelId || busy) return;
    setBusy(true); setMessage(null);
    try {
      const result = await terminalRequest<OrderCancelResponse>(`/api/terminal/orders/${encodeURIComponent(cancelId)}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(20_000) });
      setMessage(result.message); setCancelId(null);
    } catch (failure) { setMessage(`${failure instanceof Error ? failure.message : "Cancellation was not confirmed."} Refresh account status before retrying.`); setCancelId(null); }
    finally { setBusy(false); refresh(); }
  }
  const connected = account?.connection === "connected";
  const cancelOrder = account?.orders.find((order) => order.id === cancelId);
  return <section className={styles.accountPanel} aria-label="Exchange account activity">
    <div className={styles.accountHeading}><div role="tablist" aria-label="Account data">{(["orders", "positions", "fills"] as const).map((value) => <button key={value} role="tab" id={`tab-${value}`} aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} onKeyDown={(event) => { const tabs = ["orders", "positions", "fills"] as const; const index = tabs.indexOf(value); const next = event.key === "ArrowRight" ? (index + 1) % 3 : event.key === "ArrowLeft" ? (index + 2) % 3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : -1; if (next >= 0) { event.preventDefault(); setTab(tabs[next]); document.getElementById(`tab-${tabs[next]}`)?.focus(); } }} aria-controls="account-content" onClick={() => setTab(value)}>{value}<span>{connected ? account[value].length : "—"}</span></button>)}</div><button className={styles.textButton} onClick={refresh} disabled={!signedIn} aria-label="Refresh exchange account">↻ <span>Refresh</span></button></div>
    <div id="account-content" role="tabpanel" aria-labelledby={`tab-${tab}`}>
      {!signedIn || (!connected && !loading) ? <div className={styles.accountEmpty}><span className={styles.emptyIcon}>⌁</span><div><strong>{signedIn ? "Your exchange, connected." : "Your trading desk starts here."}</strong><p>{error || account?.reason || "Connect Kalshi to see your real orders, fills, and positions in one place."}</p></div><Link href={signedIn ? "/dashboard?tab=connections" : "/login?redirect=/terminal"} className={styles.secondaryButton}>{signedIn ? "Connect account" : "Sign in"}<span>↗</span></Link></div> : loading ? <p className={styles.empty}>Syncing your account…</p> : <>
        {error && <p className={styles.error} role="alert">Account update failed: {error} Displaying the last successful snapshot.</p>}
        {account?.partial && <p className={styles.notice}>Showing a limited exchange snapshot. Open Kalshi for your complete account history.</p>}
        {account?.pendingSubmission && <p className={styles.notice}>Confirming submission for {account.pendingSubmission.ticker}. New orders are paused until its status is known.</p>}
        <div className={styles.tableScroll}>{tab === "orders" ? <table><thead><tr><th>Market / order</th><th>Outcome</th><th>Limit</th><th>Filled / quantity</th><th>Status</th><th>Created</th><th/></tr></thead><tbody>{account?.orders.map((order) => <tr key={order.id}><td><button className={styles.marketLink} onClick={() => onSelect(order.ticker)}>{order.ticker}</button><small title={order.id}>{order.id.slice(0, 12)}</small></td><td>{order.side?.toUpperCase() ?? "—"}</td><td>{cents(order.limitPrice)}</td><td>{contracts(order.filledCount)} / {contracts(order.count)}</td><td><span className={styles.orderStatus} data-state={order.status}>{order.status}</span></td><td>{dateTime(order.createdAt)}</td><td>{account.tradingEnabled && (order.remainingCount ?? 0) > 0 && ["resting", "open", "pending", "partially_filled"].includes(order.status) && <button className={styles.cancelButton} disabled={busy} onClick={() => { setCancelId(order.id); setMessage(null); }}>Cancel</button>}</td></tr>)}</tbody></table> : tab === "positions" ? <table><thead><tr><th>Market</th><th>Outcome</th><th>Contracts</th><th>Exposure</th><th>Realized P&amp;L</th><th>Fees paid</th></tr></thead><tbody>{account?.positions.map((position) => <tr key={`${position.ticker}-${position.side}`}><td><button className={styles.marketLink} onClick={() => onSelect(position.ticker)}>{position.ticker}</button></td><td>{position.side?.toUpperCase() ?? "—"}</td><td>{contracts(position.count)}</td><td>{dollars(position.marketExposureDollars)}</td><td>{dollars(position.realizedPnlDollars)}</td><td>{dollars(position.feesPaidDollars)}</td></tr>)}</tbody></table> : <table><thead><tr><th>Market</th><th>Outcome</th><th>Fill price</th><th>Contracts</th><th>Fee</th><th>Filled at</th></tr></thead><tbody>{account?.fills.map((fill) => <tr key={fill.id}><td><button className={styles.marketLink} onClick={() => onSelect(fill.ticker)}>{fill.ticker}</button></td><td>{fill.side?.toUpperCase() ?? "—"}</td><td>{cents(fill.price)}</td><td>{contracts(fill.count)}</td><td>{dollars(fill.feeDollars)}</td><td>{dateTime(fill.createdAt)}</td></tr>)}</tbody></table>}</div>
        {account && account[tab].length === 0 && <p className={styles.empty}>No {tab} returned by Kalshi. Exchange activity will appear here.</p>}
        {cancelId && <div className={styles.cancelReview}><p>Cancel {contracts(cancelOrder?.remainingCount)} remaining contracts on {cancelOrder?.ticker ?? cancelId}? Existing fills and positions stay open.</p><button className={styles.secondaryButton} disabled={busy} onClick={() => setCancelId(null)}>Keep order</button><button className={styles.primaryButton} disabled={busy} onClick={cancel}>{busy ? "Canceling…" : "Confirm cancellation"}</button></div>}
        {message && <p role="status" className={styles.notice}>{message}</p>}
        {account && <p className={styles.accountTimestamp}>Synced directly from Kalshi · {dateTime(account.fetchedAt)} · Positions can be closed on the exchange.</p>}
      </>}
    </div>
  </section>;
}
