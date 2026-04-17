"use client";

import ScrollReveal from "./ScrollReveal";
import BorderBeamCard from "./BorderBeamCard";

const features = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
        <path d="M11 8v6M8 11h6" />
      </svg>
    ),
    title: "Signals, in real time",
    description:
      "Cross-platform arbitrage detection across Kalshi and Polymarket. The moment the same event prices differently across venues, you get an alert with the edge, legs, and expected payout.",
    stat: "<200ms",
    statLabel: "alert latency",
    beam: "neon-blue" as const,
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
    title: "Risk-scored every time",
    description:
      "Every signal passes through quantitative guards — position sizing, exposure limits, liquidity checks, fee-aware edge. You see the reasoning, not just the number.",
    stat: "11",
    statLabel: "risk guards",
    beam: "neon-purple" as const,
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
    title: "Trade it your way",
    description:
      "Click through to the venue and trade it yourself, or connect your exchange keys and let Neutralis auto-execute with maker orders and cross-platform hedging.",
    stat: "2",
    statLabel: "venues supported",
    beam: "neon-green" as const,
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
        <circle cx="15" cy="15" r="2" />
      </svg>
    ),
    title: "Transparent dashboard",
    description:
      "Live feed of every signal, decision, and position. Every rejection is logged with the exact guard that triggered it — so you always know why.",
    stat: "24/7",
    statLabel: "live monitoring",
    beam: "neon-green" as const,
  },
];

export default function FeaturesGrid() {
  return (
    <section id="features" className="border-t border-border py-24">
      <div className="mx-auto max-w-5xl px-6">
        <ScrollReveal>
          <p className="text-center font-mono text-[10px] font-medium uppercase tracking-[0.3em] text-text-secondary">
            How it works
          </p>
          <h2 className="mt-3 text-center text-3xl font-[family-name:var(--font-italiana)] font-normal uppercase tracking-[0.08em] text-text-primary">
            Signals first. Execution optional.
          </h2>
        </ScrollReveal>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {features.map((f, i) => (
            <ScrollReveal key={f.title} delay={i * 0.1}>
              <BorderBeamCard beamColor={f.beam} duration={8 + i * 2} className="h-full">
                <div className="p-8">
                  {/* Icon + stat row */}
                  <div className="flex items-start justify-between">
                    <div className={`rounded-lg border p-2.5 ${
                      f.beam === "neon-blue"
                        ? "border-neon-blue/20 bg-neon-blue/5 text-neon-blue"
                        : f.beam === "neon-purple"
                          ? "border-neon-purple/20 bg-neon-purple/5 text-neon-purple"
                          : "border-neon-green/20 bg-neon-green/5 text-neon-green"
                    }`}>
                      {f.icon}
                    </div>
                    <div className="text-right">
                      <span className={`font-mono text-2xl font-bold ${
                        f.beam === "neon-blue" ? "text-neon-blue"
                          : f.beam === "neon-purple" ? "text-neon-purple"
                            : "text-neon-green"
                      }`}>
                        {f.stat}
                      </span>
                      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-text-secondary">
                        {f.statLabel}
                      </p>
                    </div>
                  </div>

                  <h3 className="mt-5 font-[family-name:var(--font-cormorant)] text-xl font-medium text-text-primary">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                    {f.description}
                  </p>
                </div>
              </BorderBeamCard>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
