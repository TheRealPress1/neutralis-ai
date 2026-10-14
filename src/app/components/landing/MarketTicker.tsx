"use client";

import { useEffect, useRef, useState, type FocusEvent } from "react";
import type { TickerFeed, TickerQuote } from "@/lib/market-ticker/types";
import styles from "../../landing.module.css";

const POLL_INTERVAL = 30_000;
const REQUEST_TIMEOUT = 12_000;
const MAX_RETAINED_QUOTE_AGE = 5 * 60_000;
const centsFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

function expireRetainedQuotes(feed: TickerFeed | null, now: number): TickerFeed | null {
  if (!feed) return null;
  return {
    ...feed,
    markets: feed.markets.map((market): TickerQuote => {
      if (market.status === "closed") return market;
      const checkedAt = market.updatedAt ? Date.parse(market.updatedAt) : NaN;
      if (Number.isFinite(checkedAt) && now - checkedAt <= MAX_RETAINED_QUOTE_AGE) return market;
      return { ...market, price: null, change24h: null, history: [], status: "unavailable" };
    }),
  };
}

function formatPrice(price: number | null) {
  return price === null ? "—" : `${centsFormatter.format(price * 100)}¢`;
}

function formatChange(change: number | null) {
  if (change === null) return "—";
  return `${change > 0 ? "+" : change < 0 ? "−" : ""}${centsFormatter.format(Math.abs(change) * 100)}¢`;
}

function sparklinePoints(history: number[]) {
  const values = history.filter((value) => Number.isFinite(value) && value >= 0 && value <= 1);
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const range = Math.max(...values) - min;
  return values.map((value, index) => {
    const x = 1 + (index / (values.length - 1)) * 41;
    const y = range === 0 ? 12 : 21 - ((value - min) / range) * 18;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

function getDisplayStatus(market: TickerQuote, fetchFailed: boolean) {
  return fetchFailed && market.status === "live" ? "stale" : market.status;
}

function MarketQuote({ market, duplicate, fetchFailed }: {
  market: TickerQuote;
  duplicate: boolean;
  fetchFailed: boolean;
}) {
  const status = getDisplayStatus(market, fetchFailed);
  const changeClass = market.change24h === null || market.change24h === 0
    ? styles.tickerNeutral
    : market.change24h > 0 ? styles.positive : styles.negative;
  const points = sparklinePoints(market.history);
  const updatedAt = market.updatedAt ? new Date(market.updatedAt) : null;
  const updatedLabel = updatedAt && Number.isFinite(updatedAt.getTime())
    ? `Checked: ${updatedAt.toLocaleString("en-US")}.`
    : "Check time unavailable.";
  const priceLabel = market.price === null ? "unavailable" : formatPrice(market.price);
  const changeLabel = market.change24h === null ? "unavailable" : formatChange(market.change24h);

  return (
    <li className={styles.tickerMarket}>
      <a
        className={styles.tickerMarketLink}
        href={market.url}
        target="_blank"
        rel="noopener noreferrer"
        tabIndex={duplicate ? -1 : undefined}
        title={`${market.question}\nKalshi · YES last trade price\n${updatedLabel}${status !== "live" ? ` ${status.toUpperCase()}.` : ""}`}
        aria-label={`${market.question}. Kalshi YES last trade price ${priceLabel}. 24-hour change ${changeLabel}. ${status !== "live" ? `${status}. ` : ""}Opens Kalshi in a new tab.`}
      >
        <span>{market.label}</span>
        <strong><small>YES </small>{formatPrice(market.price)}</strong>
        {points && (
          <svg width="43" height="24" viewBox="0 0 43 24" aria-hidden="true" className={changeClass}>
            <polyline points={points} stroke="currentColor" strokeWidth="1.3" fill="none" />
          </svg>
        )}
        <span className={changeClass} title="24-hour change in YES price, in cents">{formatChange(market.change24h)} <small>24H</small></span>
        {status !== "live" && <small className={styles.tickerStatus}>{status.toUpperCase()}</small>}
      </a>
    </li>
  );
}

export default function MarketTicker() {
  const [paused, setPaused] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [feed, setFeed] = useState<TickerFeed | null>(null);
  const [fetchFailed, setFetchFailed] = useState(false);
  const focusFrameRef = useRef<number | null>(null);

  useEffect(() => {
    let disposed = false;
    let pollTimer: number | undefined;
    let requestController: AbortController | null = null;
    let lastSuccessAt: number | null = null;

    function scheduleNextPoll() {
      window.clearTimeout(pollTimer);
      if (!disposed && document.visibilityState === "visible") {
        pollTimer = window.setTimeout(refresh, POLL_INTERVAL);
      }
    }

    async function refresh() {
      if (disposed || document.visibilityState !== "visible") return;
      window.clearTimeout(pollTimer);
      requestController?.abort();
      const controller = new AbortController();
      requestController = controller;
      let timedOut = false;
      const requestTimer = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, REQUEST_TIMEOUT);

      try {
        const response = await fetch("/api/market-ticker", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Market feed unavailable");
        const data: TickerFeed = await response.json();
        if (!data || !Array.isArray(data.markets) || typeof data.fetchedAt !== "string") {
          throw new Error("Invalid market feed");
        }
        if (!disposed && !controller.signal.aborted) {
          lastSuccessAt = Date.now();
          setFeed(data);
          setFetchFailed(false);
        }
      } catch {
        if (!disposed && (!controller.signal.aborted || timedOut)) {
          // Retain recent quotes as stale, then remove them after five minutes.
          const now = Date.now();
          setFeed((current) => expireRetainedQuotes(current, now));
          setFetchFailed(true);
        }
      } finally {
        window.clearTimeout(requestTimer);
        if (requestController === controller) {
          requestController = null;
          scheduleNextPoll();
        }
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        const now = Date.now();
        setFeed((current) => expireRetainedQuotes(current, now));
        if (lastSuccessAt !== null && now - lastSuccessAt > 60_000) {
          setFetchFailed(true);
        }
        void refresh();
      } else {
        window.clearTimeout(pollTimer);
        requestController?.abort();
        requestController = null;
      }
    }

    void refresh();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      disposed = true;
      window.clearTimeout(pollTimer);
      requestController?.abort();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => () => {
    if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current);
  }, []);

  function handleFocus(event: FocusEvent<HTMLDivElement>) {
    const target = event.target;
    // Pointer focus must not hide a duplicated link before its click navigates.
    if (!target.matches(":focus-visible")) return;
    setFocusMode(true);
    if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current);
    focusFrameRef.current = window.requestAnimationFrame(() => {
      target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
    });
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setFocusMode(false);
      event.currentTarget.scrollLeft = 0;
    }
  }

  const markets = feed?.markets ?? [];
  const hasMarkets = markets.length > 0;
  const hasRetainedPrice = markets.some((market) => market.price !== null);
  const feedStatus = !feed && !fetchFailed ? "LOADING"
    : hasMarkets && markets.every((market) => market.status === "closed") ? "CLOSED"
    : fetchFailed ? hasRetainedPrice ? "STALE" : "UNAVAILABLE"
    : markets.some((market) => market.status === "live") ? "LIVE"
    : markets.some((market) => market.status === "stale") ? "STALE"
    : "UNAVAILABLE";

  return (
    <section className={styles.ticker} aria-label="Kalshi market prices. YES last trade prices; 24-hour changes in cents.">
      <div className={styles.tickerInner}>
        <span className={styles.tickerLabel} data-status={feedStatus.toLowerCase()} title="Kalshi YES last trade prices · refreshed every 30 seconds"><span /> KALSHI PULSE <small>{feedStatus}</small></span>
        <div
          className={`${styles.tickerViewport}${focusMode ? ` ${styles.tickerFocused}` : ""}`}
          tabIndex={hasMarkets ? 0 : undefined}
          aria-label="YES last trade prices. Focus or hover to pause the ticker."
          onFocusCapture={handleFocus}
          onBlurCapture={handleBlur}
        >
          {hasMarkets ? (
            <div className={styles.tickerTrack} style={{ animationPlayState: paused ? "paused" : undefined }}>
              {[false, true].map((duplicate) => (
                <ul className={styles.tickerGroup} aria-hidden={duplicate || undefined} key={String(duplicate)}>
                  {markets.map((market) => <MarketQuote key={market.id} market={market} duplicate={duplicate} fetchFailed={fetchFailed} />)}
                </ul>
              ))}
            </div>
          ) : (
            <span className={styles.tickerPlaceholder} role="status">
              {feedStatus === "LOADING" ? "Loading current market prices…" : "Market prices are temporarily unavailable."}
            </span>
          )}
        </div>
        {hasMarkets && (
          <button
            type="button"
            className={styles.tickerPause}
            onClick={() => setPaused((value) => !value)}
            aria-label={paused ? "Resume market ticker" : "Pause market ticker"}
            aria-pressed={paused}
            title={paused ? "Resume ticker" : "Pause ticker"}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
              {paused ? <path d="m3 1 8 5-8 5V1Z" /> : <><rect x="2" y="2" width="2" height="8" rx=".5" /><rect x="8" y="2" width="2" height="8" rx=".5" /></>}
            </svg>
          </button>
        )}
      </div>
    </section>
  );
}
