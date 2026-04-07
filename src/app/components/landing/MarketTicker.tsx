"use client";

const MARKETS = [
  { q: "BTC > $150K by Dec 2026", side: "YES", pct: 34 },
  { q: "Fed cuts rates July 2026", side: "YES", pct: 61 },
  { q: "Trump wins 2028 GOP primary", side: "YES", pct: 78 },
  { q: "SpaceX Starship orbit by Q3", side: "YES", pct: 52 },
  { q: "Apple releases AR glasses 2026", side: "NO", pct: 73 },
  { q: "S&P 500 > 6500 EOY", side: "YES", pct: 44 },
  { q: "Ukraine ceasefire by Sept", side: "NO", pct: 68 },
  { q: "Tesla FSD Level 4 approval", side: "NO", pct: 81 },
  { q: "OpenAI IPO 2026", side: "YES", pct: 39 },
  { q: "Champions League — Real Madrid", side: "YES", pct: 27 },
  { q: "ETH > $5K by Q4 2026", side: "YES", pct: 31 },
  { q: "US recession by Q1 2027", side: "NO", pct: 56 },
];

function TickerItem({ q, side, pct }: { q: string; side: string; pct: number }) {
  const isYes = side === "YES";
  return (
    <div className="flex shrink-0 items-center gap-3 rounded-lg border border-border/50 bg-bg-secondary/50 px-4 py-2.5">
      <span className="max-w-[220px] truncate text-xs text-text-primary">{q}</span>
      <span className={`font-mono text-xs font-bold ${isYes ? "text-neon-green" : "text-neon-red"}`}>
        {side} {pct}%
      </span>
    </div>
  );
}

export default function MarketTicker() {
  // Double the items for seamless loop
  const items = [...MARKETS, ...MARKETS];

  return (
    <section className="relative border-y border-border/30 bg-bg-primary/80 py-4 overflow-hidden">
      {/* Fade edges */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-24 bg-gradient-to-r from-bg-primary to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-24 bg-gradient-to-l from-bg-primary to-transparent" />

      <div className="flex gap-4" style={{ animation: "marquee-scroll 60s linear infinite" }}>
        {items.map((m, i) => (
          <TickerItem key={i} {...m} />
        ))}
      </div>

      <style jsx>{`
        @keyframes marquee-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}
