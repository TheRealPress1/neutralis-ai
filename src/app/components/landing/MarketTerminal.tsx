"use client";

import { useId, useState } from "react";
import styles from "./MarketTerminal.module.css";

type Category = "All markets" | "Politics" | "Sports" | "Crypto" | "Economics";
type Market = {
  id: string;
  title: string;
  category: Exclude<Category, "All markets">;
  tag: string;
  kalshi: number;
  polymarketNo: number;
  volume: string;
  trend: number[];
};

const MARKETS: Market[] = [
  { id: "fed", title: "Fed rate cut by December?", category: "Economics", tag: "FED · DEC 2026", kalshi: 62, polymarketNo: 34, volume: "$2.4M", trend: [29, 27, 30, 24, 28, 21, 23, 17, 20, 12, 15, 8] },
  { id: "bitcoin", title: "Bitcoin above $100,000 this year?", category: "Crypto", tag: "BTC · DEC 2026", kalshi: 71, polymarketNo: 26, volume: "$8.1M", trend: [31, 24, 28, 19, 24, 16, 18, 11, 15, 7, 12, 6] },
  { id: "senate", title: "Democrats win the Senate?", category: "Politics", tag: "US ELECTION · NOV 2026", kalshi: 43, polymarketNo: 55, volume: "$5.6M", trend: [13, 19, 15, 22, 18, 25, 21, 28, 24, 19, 23, 17] },
  { id: "basketball", title: "Oklahoma City wins the title?", category: "Sports", tag: "NBA · JUN 2027", kalshi: 28, polymarketNo: 69, volume: "$920K", trend: [30, 25, 29, 22, 24, 16, 21, 18, 12, 15, 9, 10] },
  { id: "ethereum", title: "Ethereum above $4,000 this year?", category: "Crypto", tag: "ETH · DEC 2026", kalshi: 48, polymarketNo: 49, volume: "$1.7M", trend: [27, 29, 23, 27, 19, 22, 15, 20, 11, 16, 9, 12] },
  { id: "inflation", title: "US inflation below 3% in December?", category: "Economics", tag: "CPI · DEC 2026", kalshi: 76, polymarketNo: 22, volume: "$680K", trend: [27, 23, 25, 18, 21, 16, 18, 11, 15, 9, 11, 6] },
  { id: "house", title: "Republicans retain the House?", category: "Politics", tag: "US ELECTION · NOV 2026", kalshi: 39, polymarketNo: 58, volume: "$3.2M", trend: [13, 9, 16, 12, 19, 14, 23, 18, 25, 21, 27, 23] },
];

const CATEGORIES: Category[] = ["All markets", "Politics", "Sports", "Crypto", "Economics"];

function Icon({ name, size = 16, filled = false }: { name: "grid" | "star" | "search" | "arrow" | "chevron" | "chart"; size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === "grid" && <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>}
      {name === "star" && <path d="m12 3 2.8 5.7 6.3.9-4.55 4.45 1.07 6.28L12 17.36l-5.62 2.97 1.07-6.28L2.9 9.6l6.3-.9L12 3Z" />}
      {name === "search" && <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>}
      {name === "arrow" && <><path d="M5 12h14M13 6l6 6-6 6" /></>}
      {name === "chevron" && <path d="m9 5 7 7-7 7" />}
      {name === "chart" && <><path d="M4 4v16h16M7 14l4-5 4 3 5-7" /></>}
    </svg>
  );
}

function Sparkline({ values, positive }: { values: number[]; positive: boolean }) {
  return (
    <svg className={styles.sparkline} width="69" height="30" viewBox="0 0 69 36" aria-hidden="true">
      <polyline points={values.map((value, index) => `${index * 6.2},${value}`).join(" ")} fill="none" stroke={positive ? "#80b99a" : "#a69c85"} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function PriceChart({ market }: { market: Market }) {
  const gradientId = useId();
  const polyYes = 100 - market.polymarketNo;
  const upper = Math.min(100, Math.max(market.kalshi, polyYes) + 8);
  const lower = Math.max(0, Math.min(market.kalshi, polyYes) - 12);
  const offsets = [-9, -8, -9, -6, -7, -5, -6, -2, -3, -1, -2, 0];
  const y = (price: number) => 105 - ((price - lower) / (upper - lower)) * 92;
  const pathFor = (price: number, shift: boolean) => offsets.map((offset, i) => `${i === 0 ? "M" : "L"} ${12 + i * 21.5} ${y(price + offset + (shift && i > 0 && i < 11 ? (i % 3) - 1 : 0))}`).join(" ");
  const kalshiPath = pathFor(market.kalshi, false);
  const polyPath = pathFor(polyYes, true);

  return (
    <div className={styles.priceChart}>
      <div className={styles.chartHeading}><span>YES PRICE HISTORY</span><span>24H <span className={styles.sample}>SAMPLE</span></span></div>
      <svg className={styles.chartSvg} viewBox="0 0 286 137" role="img" aria-label={`Illustrative 24 hour YES prices: Kalshi ${market.kalshi} cents, Polymarket ${polyYes} cents.`}>
        <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f18b4c" stopOpacity=".13" /><stop offset="100%" stopColor="#f18b4c" stopOpacity="0" /></linearGradient></defs>
        {[13, 59, 105].map((value) => <path key={value} d={`M 12 ${value} H 250`} stroke="#2a2d2b" strokeDasharray="2 4" />)}
        <path d={`${kalshiPath} L 248.5 112 L 12 112 Z`} fill={`url(#${gradientId})`} />
        <path d={polyPath} fill="none" stroke="#a4b4d4" strokeWidth="1.7" strokeLinejoin="round" />
        <path d={kalshiPath} fill="none" stroke="#f18b4c" strokeWidth="1.7" strokeLinejoin="round" />
        <circle cx="248.5" cy={y(market.kalshi)} r="3" fill="#f18b4c" stroke="#141615" strokeWidth="2" />
        <circle cx="248.5" cy={y(polyYes)} r="3" fill="#a4b4d4" stroke="#141615" strokeWidth="2" />
        <g fill="#737b76" fontSize="8" fontFamily="monospace"><text x="259" y="16">{upper}¢</text><text x="259" y="62">{Math.round((upper + lower) / 2)}¢</text><text x="259" y="108">{lower}¢</text><text x="12" y="130">00:00</text><text x="113" y="130">12:00</text><text x="224" y="130">23:59</text></g>
      </svg>
      <div className={styles.chartLegend}><span><i className={styles.kalshiDot} /> Kalshi YES</span><span><i className={styles.polyDot} /> Polymarket YES</span></div>
    </div>
  );
}

export default function MarketTerminal() {
  const [category, setCategory] = useState<Category>("All markets");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("fed");
  const [favorites, setFavorites] = useState<string[]>(["fed", "bitcoin"]);
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const visibleMarkets = MARKETS.filter((item) => (category === "All markets" || item.category === category) && (!watchlistOnly || favorites.includes(item.id)) && `${item.title} ${item.category} ${item.tag}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => (a.kalshi + a.polymarketNo) - (b.kalshi + b.polymarketNo));
  const market = visibleMarkets.find((item) => item.id === selectedId) ?? visibleMarkets[0] ?? MARKETS.find((item) => item.id === selectedId) ?? MARKETS[0];
  const cost = market.kalshi + market.polymarketNo;
  const edge = 100 - cost;
  const isSaved = favorites.includes(market.id);

  const toggleFavorite = (id: string) => setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  return (
    <div className={styles.terminal}>
      <header className={styles.windowHeader}>
        <div className={styles.windowBrand}><span className={styles.wordmark}>Neutralis.ai</span><span className={styles.headerSlash}>/</span><span className={styles.workspaceName}>Market workspace</span></div>
        <span className={styles.demoBadge}><span /> INTERACTIVE DEMO</span>
      </header>

      <div className={styles.workspace}>
        <nav className={styles.rail} aria-label="Demo workspace views">
          <button type="button" className={`${styles.railButton} ${!watchlistOnly ? styles.railActive : ""}`} aria-label="All markets scanner" aria-pressed={!watchlistOnly} title="Market scanner" onClick={() => setWatchlistOnly(false)}><Icon name="grid" size={18} /></button>
          <button type="button" className={`${styles.railButton} ${watchlistOnly ? styles.railActive : ""}`} aria-label={`Watchlist, ${favorites.length} saved markets`} aria-pressed={watchlistOnly} title="Your watchlist" onClick={() => setWatchlistOnly(true)}><Icon name="star" size={19} /></button>
          <div className={styles.railBottom} title="Sample market data"><Icon name="chart" size={18} /></div>
        </nav>

        <div className={styles.scanner}>
          <div className={styles.scannerHeading}>
            <div><span className={styles.eyebrow}>CROSS-EXCHANGE INTELLIGENCE</span><h3>{watchlistOnly ? "Your watchlist" : "Market scanner"}<span>{visibleMarkets.length}</span></h3></div>
            <div className={styles.pairBadge}><span className={styles.pairIcon}>K</span><span className={styles.pairIconPoly}>P</span><span>2 exchanges</span></div>
          </div>

          <div className={styles.filters} aria-label="Filter markets">
            <div className={styles.categories} role="group" aria-label="Market category">
              {CATEGORIES.map((item) => <button type="button" key={item} className={category === item ? styles.categoryActive : ""} onClick={() => setCategory(item)} aria-pressed={category === item}>{item}</button>)}
            </div>
            <label className={styles.search}><Icon name="search" size={14} /><input aria-label="Search sample markets" type="search" placeholder="Search markets" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          </div>

          <p className={styles.scrollHint}>Scroll the table to compare prices <Icon name="arrow" size={11} /></p>
          <div className={styles.tableScroller} role="region" aria-label="Sample market price comparison; scroll horizontally for all columns" tabIndex={0}>
            <table className={styles.marketTable}>
              <caption className={styles.srOnly}>Illustrative cross-exchange opportunities. Select a market to inspect its example prices. Edge is before fees.</caption>
              <thead><tr><th scope="col">MARKET</th><th scope="col">KALSHI <span>YES</span></th><th scope="col">POLY <span>NO</span></th><th scope="col">EDGE <span>↓</span></th><th scope="col">24H</th><th scope="col"><span className={styles.srOnly}>Watchlist</span></th></tr></thead>
              <tbody>
                {visibleMarkets.map((item) => (
                  <tr key={item.id} className={market.id === item.id ? styles.selectedRow : ""}>
                    <td><button type="button" className={styles.marketButton} onClick={() => setSelectedId(item.id)} aria-pressed={market.id === item.id}><span className={styles.marketTitle}>{item.title}</span><span className={styles.marketMeta}>{item.tag}<span className={styles.volume}>{item.volume} VOL</span></span></button></td>
                    <td className={styles.quote}>{item.kalshi}<span>¢</span></td>
                    <td className={styles.quote}>{item.polymarketNo}<span>¢</span></td>
                    <td><span className={styles.edge}>{100 - item.kalshi - item.polymarketNo}<span>¢</span></span></td>
                    <td><Sparkline values={item.trend} positive={item.trend[0] > item.trend[item.trend.length - 1]} /></td>
                    <td><button type="button" className={`${styles.favorite} ${favorites.includes(item.id) ? styles.saved : ""}`} onClick={() => toggleFavorite(item.id)} aria-label={`${favorites.includes(item.id) ? "Remove" : "Save"} ${item.title} ${favorites.includes(item.id) ? "from" : "to"} watchlist`} aria-pressed={favorites.includes(item.id)}><Icon name="star" size={13} filled={favorites.includes(item.id)} /></button></td>
                  </tr>
                ))}
                {visibleMarkets.length === 0 && <tr><td colSpan={6}><div className={styles.emptyState}><Icon name={watchlistOnly ? "star" : "search"} size={24} /><strong>No markets found</strong><span>{watchlistOnly ? "Save a market with the star, or adjust your filters." : "Try a different search or market category."}</span><button type="button" onClick={() => { setQuery(""); setCategory("All markets"); setWatchlistOnly(false); }}>Reset filters <Icon name="arrow" size={13} /></button></div></td></tr>}
              </tbody>
            </table>
          </div>
          <div className={styles.scannerFooter}><span><span className={styles.statusDot} /> {visibleMarkets.length} sample pairs</span><span>Select a market to explore <Icon name="arrow" size={12} /></span></div>
        </div>

        <aside className={styles.detail} aria-label="Selected market opportunity">
          <div className={styles.detailTop}><span>OPPORTUNITY DETAIL</span><span className={styles.detailIndex}>PAIR VIEW</span></div>
          <div aria-live="polite" aria-atomic="true">
            <span className={styles.detailCategory}>{market.category}</span>
            <h4 className={styles.detailTitle}>{market.title}</h4>
            <div className={styles.detailMeta}>Matched market pair <span>·</span> Sample quotes</div>
          </div>
          <PriceChart market={market} />

          <div className={styles.tradeHeading}><span>THE OPPORTUNITY</span><span className={styles.grossLabel}>BEFORE FEES</span></div>
          <div className={styles.tradeRow}><span><i className={styles.exchangeLogo}>K</i>Kalshi <b className={styles.yesLabel}>BUY YES</b></span><strong>{market.kalshi}¢</strong></div>
          <div className={styles.tradeRow}><span><i className={`${styles.exchangeLogo} ${styles.polyLogo}`}>P</i>Polymarket <b className={styles.noLabel}>BUY NO</b></span><strong>{market.polymarketNo}¢</strong></div>
          <div className={styles.edgeSummary}><div><span>Combined cost <b>{cost}¢</b></span><span>Gross edge per pair</span></div><strong>+{edge}<span>¢</span></strong></div>
          <button type="button" className={`${styles.watchButton} ${isSaved ? styles.watchButtonSaved : ""}`} onClick={() => toggleFavorite(market.id)} aria-pressed={isSaved}><Icon name="star" size={14} filled={isSaved} />{isSaved ? "Added to watchlist" : "Add to watchlist"}<Icon name="chevron" size={13} /></button>
          <p className={styles.detailNote}>$1 paired payout assumes identical settlement. Fees, liquidity, and execution risk apply.</p>
        </aside>
      </div>
      <footer className={styles.windowFooter}><span><span className={styles.footerSquare} /> DEMO ENVIRONMENT <span className={styles.footerDivider}>/</span> Illustrative data. No real orders.</span><span>NEUTRALIS TERMINAL <span className={styles.version}>v.01</span></span></footer>
    </div>
  );
}
