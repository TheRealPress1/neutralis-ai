"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { TerminalMarket } from "@/lib/terminal/market-types";
import type { OrderPreviewResponse, OrderSubmitResponse, TerminalAccount, TradingSide } from "@/lib/terminal/trading-types";
import { terminalRequest } from "./useTerminalData";
import { cents, contracts, dollars } from "./format";
import styles from "./TerminalWorkspace.module.css";
import type { PendingOrderReceipt } from "./useOrderReceipt";

export default function OrderTicket({ market, signedIn, account, refreshAccount, now, stale, receipt, setReceipt, receiptReady }: { market: TerminalMarket; signedIn: boolean; account: TerminalAccount | null; refreshAccount: () => void; now: number; stale: boolean; receipt: PendingOrderReceipt | null; setReceipt: (value: PendingOrderReceipt | null) => void; receiptReady: boolean }) {
  const [side, setSide] = useState<TradingSide>("yes");
  const [price, setPrice] = useState(market.yesAsk === null ? "" : String(Number((market.yesAsk * 100).toFixed(2))));
  const [quantity, setQuantity] = useState("10");
  const [review, setReview] = useState<OrderPreviewResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OrderSubmitResponse | null>(null);
  const inFlight = useRef(false);
  const count = Number(quantity), limitPrice = Number(price) / 100;
  const valid = Number.isInteger(count) && count > 0 && count <= 1_000 && Number.isFinite(limitPrice) && limitPrice > 0 && limitPrice < 1;
  const connected = account?.connection === "connected";
  const expired = review !== null && Date.parse(review.preview.expiresAt) <= now;
  const matchedOrder = account?.orders.find((order) => order.clientOrderId === (receipt?.clientOrderId ?? result?.clientOrderId));
  const unknown = (result?.status === "unknown" || Boolean(receipt)) && !matchedOrder;
  const pending = Boolean(account?.pendingSubmission) || unknown || !receiptReady;
  function edit() { setReview(null); setError(null); if (result?.status !== "unknown") setResult(null); }
  async function preview(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || inFlight.current || pending) return;
    inFlight.current = true; setBusy(true); setError(null); setResult(null);
    try { setReview(await terminalRequest<OrderPreviewResponse>("/api/terminal/orders/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticker: market.ticker, side, count, limitPrice }), signal: AbortSignal.timeout(15_000) })); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Could not preview this order."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function submit() {
    if (!review || expired || inFlight.current || pending) return;
    inFlight.current = true; setBusy(true); setError(null);
    setReceipt({ token: review.previewToken, clientOrderId: review.preview.clientOrderId, ticker: review.preview.ticker, message: "Waiting for Kalshi to confirm this submission." });
    try {
      const response = await terminalRequest<OrderSubmitResponse>("/api/terminal/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ previewToken: review.previewToken, confirmed: true }), signal: AbortSignal.timeout(25_000) });
      setResult(response); setReview(null);
      if (response.status !== "unknown") setReceipt(null);
    } catch (failure) {
      // A network failure is not proof that the exchange rejected an order.
      setResult({ status: "unknown", order: null, clientOrderId: review.preview.clientOrderId, message: `${failure instanceof Error ? failure.message : "Connection interrupted."} Checking the exchange before another submission.` });
      setReview(null);
    } finally { inFlight.current = false; setBusy(false); refreshAccount(); }
  }
  async function reconcile() {
    if (inFlight.current) return;
    refreshAccount();
    if (!receipt) return;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const response = await terminalRequest<OrderSubmitResponse>("/api/terminal/orders/reconcile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ previewToken: receipt.token }), signal: AbortSignal.timeout(20_000) });
      setResult(response);
      if (response.status !== "unknown") setReceipt(null);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Order status is still unknown. Keep checking before placing another order."); }
    finally { inFlight.current = false; setBusy(false); refreshAccount(); }
  }
  return <aside className={styles.ticket} aria-label="Limit order ticket">
    <div className={styles.panelHeading}><span>ORDER ENTRY</span><span className={styles.realMoney}>{connected && account.tradingEnabled ? "LIVE ACCOUNT" : "PREVIEW"}</span></div>
    <div className={styles.ticketBody}>
      <div className={styles.ticketType}><strong>Buy a position</strong><span>Limit order</span></div>
      <div className={styles.outcomes}>{(["yes", "no"] as const).map((value) => <button key={value} type="button" data-side={value} aria-pressed={side === value} disabled={busy || pending} onClick={() => { setSide(value); setPrice((value === "yes" ? market.yesAsk : market.noAsk) === null ? "" : String(Number(((value === "yes" ? market.yesAsk : market.noAsk)! * 100).toFixed(2)))); edit(); }}><span>{value.toUpperCase()}</span><strong>{cents(value === "yes" ? market.yesAsk : market.noAsk)}</strong><small>Best ask</small></button>)}</div>
      <form onSubmit={preview}>
        <label className={styles.inputLabel} htmlFor="limit-price">Limit price <span>per contract</span></label><div className={styles.inputWrap}><input id="limit-price" type="number" inputMode="decimal" min="0.01" max="99.99" step="0.01" value={price} disabled={busy || pending} onChange={(event) => {setPrice(event.target.value); edit();}} required/><span>¢</span></div>
        <label className={styles.inputLabel} htmlFor="contract-count">Quantity <span>1–1,000 contracts</span></label><div className={styles.inputWrap}><input id="contract-count" type="number" inputMode="numeric" min="1" max="1000" step="1" value={quantity} disabled={busy || pending} onChange={(event) => {setQuantity(event.target.value); edit();}} required/><span>× $1</span></div>
        <div className={styles.ticketSummary}><div><span>Order value</span><strong>{valid ? dollars(count * limitPrice) : "—"}</strong></div><div><span>Payout if correct</span><strong>{valid ? dollars(count) : "—"}</strong></div><div><span>Time in force</span><span>Until canceled</span></div><div><span>Available cash</span><span>{dollars(account?.balanceDollars)}</span></div></div>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {result && <div role="status" className={result.status === "accepted" ? styles.success : styles.notice}><strong>{result.status === "accepted" ? "Order submitted" : result.status === "rejected" ? "Order rejected" : unknown ? "Confirming order status" : "Order found on exchange"}</strong><p>{matchedOrder && result.status === "unknown" ? `Order ${matchedOrder.id} confirmed on Kalshi. ${contracts(matchedOrder.filledCount)} contracts filled.` : result.message}</p>{result.order && <p>{contracts(result.order.filledCount)} filled · {contracts(result.order.remainingCount)} remaining</p>}</div>}
        {!signedIn ? <Link className={styles.primaryButton} href="/login?redirect=/terminal">Sign in to trade <span>↗</span></Link> : !connected ? <><p className={styles.notice}>{account?.reason || "Connect your Kalshi account to preview and place orders."}</p><Link className={styles.primaryButton} href="/dashboard?tab=connections">Connect Kalshi <span>↗</span></Link></> : pending ? <div className={styles.notice}>An order {receipt ? `for ${receipt.ticker} ` : ""}is being reconciled with Kalshi. New submissions are paused.<button type="button" className={styles.textButton} onClick={reconcile} disabled={busy}>Check order status ↻</button></div> : review ? <div className={styles.review} aria-label="Review real-money order"><strong>Review your order</strong><p>Buy {contracts(review.preview.count)} {review.preview.side.toUpperCase()} at up to {cents(review.preview.limitPrice)}.</p><div><span>Estimated fees</span><strong>{dollars(review.preview.estimatedFeeDollars)}</strong></div><div><span>Estimated total</span><strong>{dollars(review.preview.maxCostDollars)}</strong></div><small>{review.preview.feeDescription}</small><p className={styles.muted}>{expired ? "This preview expired. Review again for a fresh quote." : "This submits a real-money order to your Kalshi account."}</p><button type="button" className={styles.primaryButton} disabled={busy || expired || !review.preview.tradingEnabled || stale} onClick={submit}>{busy ? "Submitting…" : "Confirm & place order"}</button><button type="button" className={styles.textButton} disabled={busy} onClick={() => setReview(null)}>Back to order</button></div> : <button type="submit" className={styles.primaryButton} disabled={!valid || busy || stale || market.status === "closed"}>{busy ? "Checking order…" : "Review order"}<span>→</span></button>}
      </form>
      {connected && !account.tradingEnabled && <p className={styles.notice}>Order previews are available. Live submission is not enabled for this deployment.</p>}
      {stale && <p className={styles.notice}>Quotes are delayed. Order entry resumes after a fresh market update.</p>}
      <p className={styles.ticketFootnote}>Limit orders can fill partially or remain open. Your order appears below after the exchange confirms it. Manage position exits on Kalshi.</p>
      <a className={styles.venueLink} href={market.url} target="_blank" rel="noopener noreferrer">Open this market on Kalshi <span>↗</span></a>
    </div>
  </aside>;
}
