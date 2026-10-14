"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { MarketCategory, TerminalMarket, TerminalMarketDetail, TerminalMarketList } from "@/lib/terminal/market-types";
import type { TerminalAccount } from "@/lib/terminal/trading-types";
import { evaluateMonitors, restoreMonitors, type PriceMonitor } from "@/lib/terminal/monitors";
import { usePinnedMarkets, useTerminalData } from "./useTerminalData";
import { cents, compact, contracts, dateTime, dollars } from "./format";
import MarketChart from "./MarketChart";
import OrderTicket from "./OrderTicket";
import AccountPanel from "./AccountPanel";
import MonitorPanel from "./MonitorPanel";
import { useOrderReceipt } from "./useOrderReceipt";
import styles from "./TerminalWorkspace.module.css";

const categories: (MarketCategory | "All")[] = ["All", "Sports", "Politics", "Economics", "Crypto"];
const subscribeVisibility = (callback: () => void) => { document.addEventListener("visibilitychange", callback); return () => document.removeEventListener("visibilitychange", callback); };
const getVisibility = () => !document.hidden;
const serverVisibility = () => true;

function Depth({ detail, stale, loading }: { detail: TerminalMarketDetail | null; stale: boolean; loading: boolean }) {
  const maximum = Math.max(1, ...(detail?.orderbook.yes ?? []).slice(0, 5).map((item) => item.quantity), ...(detail?.orderbook.no ?? []).slice(0, 5).map((item) => item.quantity));
  return <section className={styles.depth} aria-label="Resting bid order book"><div className={styles.sectionHeading}><span>ORDER BOOK <span className={styles.subtle}>/ BIDS</span></span><span className={styles.subtle}>{!detail ? loading ? "LOADING" : "UNAVAILABLE" : (stale || detail?.orderbookStatus === "stale") && detail?.orderbookStatus !== "unavailable" ? "DELAYED" : detail?.orderbookStatus === "live" ? "KALSHI" : "UNAVAILABLE"}</span></div><div className={styles.depthColumns}>{(["yes", "no"] as const).map((side) => <div key={side}><div className={styles.depthHeading}><span data-side={side}>{side.toUpperCase()} BID</span><span>CONTRACTS</span></div>{detail && detail.orderbook[side].length > 0 ? detail.orderbook[side].slice(0, 5).map((level) => <div className={styles.depthRow} key={level.price}><span className={styles.depthBar} data-side={side} style={{ width: `${level.quantity / maximum * 100}%` }}/><span>{cents(level.price)}</span><span>{contracts(level.quantity)}</span></div>) : <p className={styles.depthEmpty}>{detail?.orderbookStatus === "live" ? "No resting bids" : "Depth unavailable"}</p>}</div>)}</div><p className={styles.depthNote}>A NO bid implies a YES ask at $1 minus that bid.</p></section>;
}

export default function TerminalWorkspace({ signedIn, userId }: { signedIn: boolean; userId: string | null }) {
  const orderReceipt = useOrderReceipt(userId);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<MarketCategory | "All">("All");
  const [selected, setSelected] = useState<string | null>(null);
  const [watchOnly, setWatchOnly] = useState(false);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [monitors, setMonitors] = useState<PriceMonitor[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<"markets" | "monitors">("markets");
  const [now, setNow] = useState(0);
  const search = useRef<HTMLInputElement>(null);
  const visible = useSyncExternalStore(subscribeVisibility, getVisibility, serverVisibility);
  const feed = useTerminalData<TerminalMarketList>("/api/terminal/markets", 30_000);
  const pinnedTickers = [...monitors.filter((item) => item.state === "watching").map((item) => item.ticker), ...watchlist, ...monitors.map((item) => item.ticker)].filter((id) => !(feed.data?.markets ?? []).some((item) => item.ticker === id));
  const pinned = usePinnedMarkets(pinnedTickers);
  const markets = useMemo(() => [...(feed.data?.markets ?? []), ...pinned].sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0)), [feed.data, pinned]);
  const ticker = selected ?? (feed.data?.markets.some((item) => item.ticker === "KXNBA-27-OKC") ? "KXNBA-27-OKC" : feed.data?.markets[0]?.ticker) ?? null;
  const detail = useTerminalData<TerminalMarketDetail>(ticker ? `/api/terminal/markets/${encodeURIComponent(ticker)}` : null);
  const account = useTerminalData<TerminalAccount>(signedIn ? "/api/terminal/account" : null);
  const market: TerminalMarket | null = detail.data?.market ?? markets.find((item) => item.ticker === ticker) ?? null;
  const quoteStale = !market || market.status !== "live" || Boolean(detail.error) || (now > 0 && now - Date.parse(market.updatedAt) > 45_000);
  const feedStale = Boolean(feed.error) || feed.data?.status !== "live" || (now > 0 && feed.data !== null && now - Date.parse(feed.data.fetchedAt) > 45_000);
  const filtered = useMemo(() => markets.filter((item) => (category === "All" || item.category === category) && (!watchOnly || watchlist.includes(item.ticker)) && `${item.title} ${item.subtitle} ${item.ticker}`.toLowerCase().includes(query.trim().toLowerCase())), [markets, category, watchOnly, watchlist, query]);
  /* Browser preferences require a single hydration pass; they are not derivable from server props. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // Restore browser-only preferences after hydration. No private account data is stored.
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("market");
    if (requested && /^[A-Z0-9_.-]{1,160}$/i.test(requested)) setSelected(requested);
    try {
      const storedWatchlist: unknown = JSON.parse(localStorage.getItem("neutralis-watchlist-v1") ?? "[]");
      if (Array.isArray(storedWatchlist)) setWatchlist(storedWatchlist.filter((item): item is string => typeof item === "string" && /^[A-Z0-9_.-]{1,160}$/i.test(item)).slice(0, 30));
      setMonitors(restoreMonitors(JSON.parse(localStorage.getItem("neutralis-monitors-v1") ?? "[]")));
    } catch { /* Browser storage is optional; the workspace remains usable. */ }
    setStorageReady(true);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    function keyboard(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setWorkspaceTab("markets"); requestAnimationFrame(() => search.current?.focus()); }
      if (event.key === "Escape" && document.activeElement === search.current) { setQuery(""); search.current?.blur(); }
    }
    window.addEventListener("keydown", keyboard);
    return () => { clearInterval(clock); window.removeEventListener("keydown", keyboard); };
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => { if (storageReady) try { localStorage.setItem("neutralis-watchlist-v1", JSON.stringify(watchlist)); localStorage.setItem("neutralis-monitors-v1", JSON.stringify(monitors)); } catch { /* Optional persistence. */ } }, [watchlist, monitors, storageReady]);
  useEffect(() => {
    if (!visible) return;
    const quotes = [...markets, ...(detail.data ? [detail.data.market] : [])];
    const timer = setInterval(() => setMonitors((previous) => { const next = evaluateMonitors(previous, quotes, Date.now()); return next.some((item, index) => item !== previous[index]) ? next : previous; }), 1000);
    return () => clearInterval(timer);
  }, [feed.data, markets, detail.data, visible]);
  function select(ticker: string) {
    setSelected(ticker); setWorkspaceTab("markets");
    const url = new URL(window.location.href); url.searchParams.set("market", ticker); window.history.replaceState(null, "", url);
  }
  function toggleWatch(ticker: string) { setWatchlist((items) => items.includes(ticker) ? items.filter((value) => value !== ticker) : [...items, ticker].slice(-30)); }
  const watching = monitors.filter((item) => item.state === "watching").length;
  const triggered = monitors.filter((item) => item.state === "triggered").length;
  return <div className={styles.workspace}>
    <a className={styles.skipLink} href="#terminal-main">Skip to workspace</a>
    <header className={styles.header}><div className={styles.headerBrand}><Link href="/" className={styles.brand}>Neutralis.ai</Link><span className={styles.productLabel}>TERMINAL <span>01</span></span></div><div className={styles.headerActions}><span className={styles.clock}>{now ? new Date(now).toISOString().slice(11, 19) : "--:--:--"} UTC</span><Link className={styles.connectionButton} href={signedIn ? "/dashboard?tab=connections" : "/login?redirect=/terminal"}><span className={styles.statusDot} data-live={account.data?.connection === "connected"}/>{account.data?.connection === "connected" ? "Kalshi connected" : "Connect exchange"}<span>↗</span></Link><Link className={styles.profileButton} href={signedIn ? "/profile" : "/login?redirect=/terminal"}>{signedIn ? "Account" : "Sign in"}</Link></div></header>
    <nav className={styles.workspaceNav} aria-label="Workspace navigation"><div><button aria-current={workspaceTab === "markets" ? "page" : undefined} onClick={() => setWorkspaceTab("markets")}><span>▦</span> Markets</button><button aria-current={workspaceTab === "monitors" ? "page" : undefined} onClick={() => setWorkspaceTab("monitors")}><span>◎</span> Monitors <small>{watching > 0 ? watching : "READ ONLY"}</small>{triggered > 0 && <span className={styles.triggerCount} aria-live="polite" aria-label={`${triggered} monitors triggered`}>{triggered}</span>}</button><Link href="/dashboard?tab=dashboard"><span>▤</span> Portfolio</Link></div><span className={styles.navHint}>THE BLOOMBERG TERMINAL FOR PREDICTION MARKETS</span></nav>
    <div className={styles.marketStrip}><div><span className={styles.statusDot} data-live={!feedStale && visible}/><strong>{!visible ? "UPDATES PAUSED" : feed.loading ? "CONNECTING" : feedStale ? "FEED DELAYED" : "MARKET FEED"}</strong><span>KALSHI</span></div><span>{feed.data?.markets.length ?? "—"} markets</span><span className={styles.stripSeparator}>/</span><span>Public quotes · 15–30s refresh</span><span className={styles.stripBalance}>Available cash <strong>{dollars(account.data?.balanceDollars)}</strong></span></div>
    <main id="terminal-main" className={styles.main}>
      {workspaceTab === "monitors" ? <MonitorPanel market={market} monitors={monitors} setMonitors={setMonitors} visible={visible} onSelect={select}/> : <>
        <div className={styles.tradingGrid}>
          <aside className={styles.marketBrowser} aria-label="Market browser"><div className={styles.browserTitle}><h1>Markets</h1><span>{filtered.length.toString().padStart(2, "0")}</span></div><div className={styles.searchBox}><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="6.8" cy="6.8" r="4.7"/><path d="m10.3 10.3 3.8 3.8"/></svg><input ref={search} aria-label="Search curated and pinned markets" placeholder="Search markets…" value={query} onChange={(event) => setQuery(event.target.value)}/><kbd>⌘ K</kbd></div><div className={styles.categories} aria-label="Market categories">{categories.map((value) => <button key={value} aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</button>)}</div><div className={styles.listLabel}><button aria-pressed={watchOnly} onClick={() => setWatchOnly(!watchOnly)}>{watchOnly ? "★ WATCHLIST" : "ALL MARKETS"}<span>{watchOnly ? watchlist.length : "☆"}</span></button><span>YES / 24H</span></div><div className={styles.marketList}>
            {feed.loading ? <div className={styles.loading}>Connecting to Kalshi<span>Fetching real market quotes…</span></div> : filtered.length === 0 ? <div className={styles.empty}>{feed.error ? "Market feed unavailable. Retrying shortly." : watchOnly ? "Star a market to add it to your watchlist." : "No markets match these filters."}{feed.error && <button className={styles.textButton} onClick={feed.refresh}>Retry ↻</button>}</div> : filtered.map((item) => <div className={styles.marketRow} data-selected={ticker === item.ticker} key={item.ticker}><button className={styles.marketSelect} onClick={() => select(item.ticker)} aria-pressed={ticker === item.ticker}><span className={styles.marketMeta}>{item.category}<span>{compact(item.volume24h)} VOL</span></span><span className={styles.marketName}>{item.subtitle || item.title}</span>{item.subtitle && <span className={styles.marketQuestion}>{item.title}</span>}<span className={styles.marketPrices}><strong>{cents(item.lastPrice)}</strong><span className={item.change24h !== null && item.change24h >= 0 ? styles.positive : styles.negative}>{item.change24h === null ? "—" : `${item.change24h >= 0 ? "+" : ""}${Number((item.change24h * 100).toFixed(2))}¢`}</span><small>{feedStale || item.status === "stale" || (now > 0 && now - Date.parse(item.updatedAt) > 45_000) ? "DELAYED" : item.status === "closed" ? "CLOSED" : "YES"}</small></span></button><button className={styles.watchButton} aria-label={`${watchlist.includes(item.ticker) ? "Remove" : "Add"} ${item.subtitle || item.title} ${watchlist.includes(item.ticker) ? "from" : "to"} watchlist`} aria-pressed={watchlist.includes(item.ticker)} onClick={() => toggleWatch(item.ticker)}>{watchlist.includes(item.ticker) ? "★" : "☆"}</button></div>)}
          </div><div className={styles.browserFootnote}>Curated + pinned markets · 24h volume<br/>{feed.data?.scope ?? "Sports, politics, economics & crypto"}</div></aside>
          <section className={styles.marketDetail} aria-label="Selected market">
            {market ? <><div className={styles.detailHeader}><div className={styles.marketBreadcrumb}><span>{market.category}</span><span>/</span><span>KALSHI</span><span className={styles.quoteBadge} data-live={!quoteStale}>{market.status === "closed" ? "CLOSED" : quoteStale ? "DELAYED" : "LIVE QUOTES"}</span></div><div className={styles.marketTitle}><div><h2>{market.title}</h2>{market.subtitle && <p>{market.subtitle}</p>}</div><button className={styles.detailStar} aria-label={watchlist.includes(market.ticker) ? "Remove selected market from watchlist" : "Add selected market to watchlist"} aria-pressed={watchlist.includes(market.ticker)} onClick={() => toggleWatch(market.ticker)}>{watchlist.includes(market.ticker) ? "★" : "☆"}</button></div><div className={styles.priceHero}><strong>{cents(market.lastPrice)}</strong><div><span>YES LAST TRADE</span><span className={market.change24h !== null && market.change24h >= 0 ? styles.positive : styles.negative}>{market.change24h === null ? "24h change unavailable" : `${market.change24h >= 0 ? "+" : ""}${Number((market.change24h * 100).toFixed(2))}¢ over 24h`}</span></div><button className={styles.monitorMarketButton} onClick={() => setWorkspaceTab("monitors")}>◎ <span>Monitor market</span></button></div><div className={styles.marketStats}><div><span>YES BID / ASK</span><strong>{cents(market.yesBid)} <i>/</i> {cents(market.yesAsk)}</strong></div><div><span>24H CONTRACTS</span><strong>{compact(market.volume24h)}</strong></div><div><span>OPEN INTEREST</span><strong>{compact(market.openInterest)}</strong></div><div><span>CLOSES</span><strong>{dateTime(market.closeTime)}</strong></div></div></div>
            {detail.error && <p className={styles.error} role="status">{detail.error} Quotes may be delayed.</p>}
            <MarketChart points={detail.data?.history ?? []} status={detail.loading ? "loading" : detail.data?.historyStatus === "unavailable" || !detail.data ? "unavailable" : detail.error || (detail.data?.historyUpdatedAt && now - Date.parse(detail.data.historyUpdatedAt) > 180_000) ? "stale" : detail.data?.historyStatus ?? "unavailable"} now={now}/><Depth detail={detail.data} loading={detail.loading} stale={Boolean(detail.error) || !detail.data?.orderbookUpdatedAt || now - Date.parse(detail.data.orderbookUpdatedAt) > 45_000}/>
            <details className={styles.rules}><summary>Resolution &amp; market rules <span>＋</span></summary><p>{detail.data?.rules.primary || "Rules have not loaded. Read the full contract on Kalshi before trading."}</p>{detail.data?.rules.secondary && <p>{detail.data.rules.secondary}</p>}<dl><div><dt>Expected settlement</dt><dd>{dateTime(detail.data?.settlementTime)}</dd></div><div><dt>Final expiration</dt><dd>{dateTime(detail.data?.expirationTime)}</dd></div></dl><a href={market.url} target="_blank" rel="noopener noreferrer">Full contract on Kalshi ↗</a><code>{market.ticker}</code></details></> : <div className={styles.detailEmpty}><span>▦</span><h2>{detail.error ? "Market unavailable" : "Your view of the market."}</h2><p>{detail.error || "Select a market to inspect its prices, order book, and resolution rules."}</p></div>}
          </section>
          {market ? <OrderTicket key={market.ticker} market={market} signedIn={signedIn} account={account.data} refreshAccount={account.refresh} now={now} receipt={orderReceipt.receipt} setReceipt={orderReceipt.setReceipt} receiptReady={orderReceipt.ready} stale={quoteStale || Boolean(account.error)}/> : <aside className={styles.ticket}><div className={styles.panelHeading}>ORDER ENTRY</div><p className={styles.empty}>Choose a market to open an order ticket.</p></aside>}
        </div><AccountPanel account={account.data} signedIn={signedIn} loading={account.loading} error={account.error} refresh={account.refresh} onSelect={select}/>
      </>}
    </main>
    <footer className={styles.statusBar}><span><span className={styles.statusDot} data-live={!feedStale && visible}/>{feedStale ? "Waiting for fresh quotes" : "Connected to public market data"}</span><span>Kalshi execution <i>·</i> {account.data?.tradingEnabled ? "Enabled" : "Preview only"}</span><button onClick={() => setWorkspaceTab("monitors")}>{watching} monitors watching{triggered > 0 ? ` · ${triggered} triggered` : ""}</button><span className={styles.statusEnd}>NEUTRALIS / WORKSPACE 01</span></footer>
  </div>;
}
