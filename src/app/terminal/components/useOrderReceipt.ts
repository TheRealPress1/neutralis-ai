"use client";

import { useCallback, useEffect, useState } from "react";

export interface PendingOrderReceipt { token: string; clientOrderId: string; ticker: string; message: string }

/** Preserve uncertainty across market changes and reloads, separately for each user. */
export function useOrderReceipt(userId: string | null) {
  const [receipt, setReceiptState] = useState<PendingOrderReceipt | null>(null);
  const [ready, setReady] = useState(false);
  const key = userId ? `neutralis-order-receipt:${userId}` : null;
  useEffect(() => {
    // The stored signed receipt must be restored after hydration, before order entry.
    let restored: PendingOrderReceipt | null = null;
    try {
      const value = key ? JSON.parse(sessionStorage.getItem(key) ?? "null") : null;
      if (value && typeof value.token === "string" && typeof value.clientOrderId === "string" && typeof value.ticker === "string" && typeof value.message === "string") restored = value;
    } catch { /* Optional persistence; the server ledger still enforces pending locks. */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Restore a browser-only execution receipt before enabling the ticket.
    setReceiptState(restored);
    setReady(true);
  }, [key]);
  const setReceipt = useCallback((value: PendingOrderReceipt | null) => {
    // Synchronous persistence precedes the POST, including a navigation during it.
    try { if (key) { if (value) sessionStorage.setItem(key, JSON.stringify(value)); else sessionStorage.removeItem(key); } } catch { /* The backend ledger remains authoritative. */ }
    setReceiptState(value);
  }, [key]);
  return { receipt, setReceipt, ready };
}
