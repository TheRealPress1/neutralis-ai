"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { TerminalMarket, TerminalMarketDetail } from "@/lib/terminal/market-types";

export async function terminalRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || `Request failed (${response.status}). Please try again.`);
  return body as T;
}

export function useTerminalData<T>(url: string | null, interval = 15_000) {
  const [snapshot, setSnapshot] = useState<{ url: string | null; data: T | null; error: string | null; loading: boolean; readStartedAt: number }>({ url: null, data: null, error: null, loading: true, readStartedAt: 0 });
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!url) return;
    let disposed = false;
    let active: AbortController | null = null;
    async function update() {
      if (document.hidden || active) return;
      const controller = new AbortController();
      const readStartedAt = Date.now();
      active = controller;
      const timeout = setTimeout(() => controller.abort(), 12_000);
      try {
        const data = await terminalRequest<T>(url!, { signal: controller.signal });
        if (!disposed) setSnapshot({ url, data, error: null, loading: false, readStartedAt });
      } catch (error) {
        if (!disposed) setSnapshot((previous) => ({ url, data: previous.url === url ? previous.data : null, error: error instanceof Error && error.name !== "AbortError" ? error.message : "Connection timed out. Retrying shortly.", loading: false, readStartedAt: previous.url === url ? previous.readStartedAt : 0 }));
      } finally { clearTimeout(timeout); if (active === controller) active = null; }
    }
    void update();
    const timer = setInterval(update, interval);
    const visible = () => { if (!document.hidden) void update(); };
    document.addEventListener("visibilitychange", visible);
    return () => { disposed = true; clearInterval(timer); active?.abort(); document.removeEventListener("visibilitychange", visible); };
  }, [url, interval, revision]);
  return { data: snapshot.url === url ? snapshot.data : null, error: snapshot.url === url ? snapshot.error : null, loading: Boolean(url) && (snapshot.url !== url || snapshot.loading), readStartedAt: snapshot.url === url ? snapshot.readStartedAt : 0, refresh };
}

/** Keep pinned markets outside the discovery feed observable after selection changes. */
export function usePinnedMarkets(tickers: string[]) {
  const key = [...new Set(tickers)].join(",");
  const [quotes, setQuotes] = useState<TerminalMarket[]>([]);
  useEffect(() => {
    if (!key) return;
    const ids = key.split(",");
    let disposed = false;
    let active: AbortController | null = null;
    async function update() {
      if (document.hidden || active) return;
      const controller = new AbortController(); active = controller;
      const timeout = setTimeout(() => controller.abort(), 20_000);
      const results: TerminalMarket[] = [];
      try {
        // Limit concurrent work when a browser restores a large watchlist.
        for (let offset = 0; offset < ids.length && !controller.signal.aborted; offset += 4) {
          const batch = await Promise.allSettled(ids.slice(offset, offset + 4).map((ticker) => terminalRequest<TerminalMarketDetail>(`/api/terminal/markets/${encodeURIComponent(ticker)}`, { signal: controller.signal })));
          for (const result of batch) if (result.status === "fulfilled") results.push(result.value.market);
        }
        if (!disposed) setQuotes((previous) => [...new Map([...previous.filter((item) => ids.includes(item.ticker)).map((item) => ({ ...item, status: item.status === "closed" ? "closed" as const : "stale" as const })), ...results].map((item) => [item.ticker, item])).values()]);
      } finally { clearTimeout(timeout); if (active === controller) active = null; }
    }
    void update();
    const timer = setInterval(update, 30_000);
    const visible = () => { if (!document.hidden) void update(); };
    document.addEventListener("visibilitychange", visible);
    return () => { disposed = true; active?.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [key]);
  return useMemo(() => quotes.filter((quote) => key.split(",").includes(quote.ticker)), [quotes, key]);
}
