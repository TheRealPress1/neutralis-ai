import Link from "next/link";

const venues = [
  {
    name: "Kalshi",
    description:
      "A CFTC-regulated exchange offering binary event contracts. Kalshi markets cover politics, economics, sports, entertainment, and more. Neutralis connects via REST and WebSocket APIs with RSA-PSS authentication.",
    badge: "Regulated",
  },
  {
    name: "Polymarket",
    description:
      "A crypto-native prediction market built on Polygon with a central limit order book (CLOB). Polymarket offers deep liquidity across political, sports, and crypto markets with near-zero fees.",
    badge: "Crypto",
  },
];

const signalTypes = [
  {
    title: "Cross-platform arbitrage",
    description:
      "The same event trades on both Kalshi and Polymarket. When the combined cost of YES on one venue and NO on the other falls below $1.00 after fees, the spread is a guaranteed profit regardless of outcome.",
    example:
      "\"Will Arsenal win the Premier League?\" trades at $0.42 on Kalshi and $0.55 on Polymarket. Buying YES on Kalshi ($0.42) and NO on Polymarket ($0.45) costs $0.87 — locking in $0.13 edge before fees.",
  },
  {
    title: "Complement arbitrage",
    description:
      "On a single venue, the YES ask plus the NO ask for the same market falls below $1.00. Since one outcome must occur, buying both sides guarantees a profit equal to the gap minus fees.",
    example:
      "A market has YES ask $0.48 and NO ask $0.49. Buying both costs $0.97 — guaranteed to pay out $1.00 for a $0.03 gross edge.",
  },
  {
    title: "Three-way Dutch book",
    description:
      "Soccer match markets have three outcomes: Team A wins, Team B wins, or Draw. If the combined ask across all three binary markets falls below $1.00 after fees on all three legs, buying all three guarantees a profit.",
    example:
      "Man City ($0.45) + Liverpool ($0.30) + Draw ($0.22) = $0.97. One outcome must occur, paying $1.00 — netting $0.03 before fees.",
  },
];

const guards = [
  {
    name: "Minimum edge",
    description:
      "Rejects signals below a configurable edge threshold (default: 0.05% for cross-platform, 1.0% for same-venue). Ensures trades are profitable after fees and slippage.",
  },
  {
    name: "Liquidity check",
    description:
      "Verifies the orderbook has sufficient depth to fill the position size without excessive slippage. Scales with the intended trade size.",
  },
  {
    name: "Exposure limits",
    description:
      "Enforces maximum exposure per ticker, per event, per venue, and total portfolio. Prevents concentration risk.",
  },
  {
    name: "Daily loss limit",
    description:
      "Halts trading if realized losses for the day exceed a configurable dollar threshold. Resets at midnight UTC.",
  },
  {
    name: "Max open positions",
    description:
      "Caps the total number of concurrent open positions to manage portfolio complexity and margin requirements.",
  },
  {
    name: "Spread filter",
    description:
      "Rejects markets with excessively wide bid-ask spreads or one-sided quotes, which indicate low liquidity or stale pricing.",
  },
];

const exitStrategies = [
  {
    name: "Stop-loss",
    threshold: "15%",
    description: "Closes a position if unrealized loss exceeds 15% of entry value.",
  },
  {
    name: "Take-profit",
    threshold: "25%",
    description: "Locks in gains when unrealized profit reaches 25% of entry value.",
  },
  {
    name: "Time decay",
    threshold: "24h",
    description:
      "Exits positions held longer than 24 hours if the remaining edge has fallen below a floor threshold.",
  },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-[#050608] text-[#e8e9ea]">
      {/* ── Nav ────────────────────────────────────────────── */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="font-[family-name:var(--font-italiana)] text-xl font-normal tracking-[0.08em] text-white/90"
          >
            Neutralis.ai
          </Link>
          <Link
            href="/"
            className="text-sm text-[#9ca3af] transition-colors hover:text-[#e8e9ea]"
          >
            &larr; Back to home
          </Link>
        </div>
      </nav>

      {/* ── Content ────────────────────────────────────────── */}
      <main className="mx-auto max-w-4xl px-6 pt-28 pb-24">
        <h1 className="font-[family-name:var(--font-italiana)] text-4xl font-normal uppercase tracking-[0.08em] sm:text-5xl">
          How Neutralis Works
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-[#9ca3af]">
          A technical overview of the automated prediction market arbitrage
          system — from signal detection to trade execution.
        </p>

        {/* ── Overview ──────────────────────────────────────── */}
        <section className="mt-16">
          <h2 className="font-[family-name:var(--font-italiana)] text-2xl font-normal uppercase tracking-[0.08em]">
            Overview
          </h2>
          <div className="mt-6 space-y-4 text-[#c8ccd2] leading-relaxed">
            <p>
              Prediction markets let participants trade on the probability of
              real-world events. When two exchanges price the same event
              differently, an arbitrage opportunity exists — buy the underpriced
              side on one venue, sell the overpriced side on the other, and
              profit regardless of the outcome.
            </p>
            <p>
              Neutralis automates this entire pipeline: scanning thousands of
              markets in real time, matching events across platforms using NLP,
              calculating edge after fees and slippage, evaluating each trade
              through a series of risk guards, and executing cross-platform
              pairs with sub-second latency.
            </p>
          </div>
        </section>

        {/* ── Venues ────────────────────────────────────────── */}
        <section className="mt-16">
          <h2 className="font-[family-name:var(--font-italiana)] text-2xl font-normal uppercase tracking-[0.08em]">
            Supported Venues
          </h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {venues.map((v) => (
              <div
                key={v.name}
                className="card-panel rounded-xl p-6"
              >
                <div className="flex items-center gap-3">
                  <h3 className="font-[family-name:var(--font-cormorant)] text-xl font-medium">
                    {v.name}
                  </h3>
                  <span className="rounded-full bg-[#1a1d21] border border-[#22262d] px-2.5 py-0.5 text-xs font-medium text-[#a1a8b3]">
                    {v.badge}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[#9ca3af]">
                  {v.description}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-6 card-panel rounded-xl p-6">
            <h3 className="font-[family-name:var(--font-cormorant)] text-lg font-medium">
              Cross-platform matching
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#9ca3af]">
              Markets are paired across venues using TF-IDF text similarity,
              entity extraction, and temporal alignment. Abbreviations are
              expanded automatically (&ldquo;Man City&rdquo; &rarr;
              &ldquo;Manchester City&rdquo;), and each market matches at most
              once to prevent duplicated signals. The system currently tracks
              70+ matched pairs across sports, politics, entertainment, and
              crypto categories.
            </p>
          </div>
        </section>

        {/* ── Signal Detection ──────────────────────────────── */}
        <section className="mt-16">
          <h2 className="font-[family-name:var(--font-italiana)] text-2xl font-normal uppercase tracking-[0.08em]">
            Signal Detection
          </h2>
          <p className="mt-4 text-[#9ca3af]">
            Three types of arbitrage signals are detected in real time:
          </p>
          <div className="mt-6 space-y-6">
            {signalTypes.map((s) => (
              <div
                key={s.title}
                className="card-panel rounded-xl p-6"
              >
                <h3 className="font-[family-name:var(--font-cormorant)] text-xl font-medium">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#9ca3af]">
                  {s.description}
                </p>
                <div className="mt-4 rounded-lg bg-[#050608] border border-[#1a1d21] px-4 py-3">
                  <p className="text-xs font-medium text-[#a1a8b3] mb-1">Example</p>
                  <p className="text-sm text-[#c8ccd2]">{s.example}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Risk Management ───────────────────────────────── */}
        <section className="mt-16">
          <h2 className="font-[family-name:var(--font-italiana)] text-2xl font-normal uppercase tracking-[0.08em]">
            Risk Management
          </h2>
          <p className="mt-4 text-[#9ca3af]">
            Every signal passes through a guard pipeline before execution.
            All guards must pass for a trade to be placed.
          </p>

          <h3 className="mt-8 font-[family-name:var(--font-cormorant)] text-lg font-medium">
            Pre-trade guards
          </h3>
          <div className="mt-4 space-y-3">
            {guards.map((g) => (
              <div
                key={g.name}
                className="flex gap-4 rounded-lg bg-[#0e1117] border border-[#22262d] px-5 py-4"
              >
                <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-[#e8e9ea]">{g.name}</p>
                  <p className="mt-1 text-xs text-[#9ca3af]">{g.description}</p>
                </div>
              </div>
            ))}
          </div>

          <h3 className="mt-8 font-[family-name:var(--font-cormorant)] text-lg font-medium">
            Exit strategies
          </h3>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {exitStrategies.map((e) => (
              <div
                key={e.name}
                className="card-panel rounded-xl p-5"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-[#e8e9ea]">{e.name}</p>
                  <span className="font-mono text-xs text-[#a1a8b3]">{e.threshold}</span>
                </div>
                <p className="mt-2 text-xs text-[#9ca3af]">{e.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Execution ─────────────────────────────────────── */}
        <section className="mt-16">
          <h2 className="font-[family-name:var(--font-italiana)] text-2xl font-normal uppercase tracking-[0.08em]">
            Execution
          </h2>
          <div className="mt-6 space-y-4 text-[#c8ccd2] leading-relaxed">
            <p>
              The system connects to both venues via WebSocket for real-time
              price updates. When a qualified signal is detected, execution
              follows a specific order to minimize risk:
            </p>
          </div>
          <div className="mt-6 space-y-4">
            <div className="flex gap-4 items-start">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#050608] border border-[#22262d] text-sm font-bold text-[#c0c5cb]">
                1
              </div>
              <div>
                <p className="text-sm font-medium text-[#e8e9ea]">Polymarket first</p>
                <p className="mt-1 text-xs text-[#9ca3af]">
                  The riskier leg executes first as a fill-or-kill (FOK) market
                  order. If it fails, no trade is placed.
                </p>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#050608] border border-[#22262d] text-sm font-bold text-[#c0c5cb]">
                2
              </div>
              <div>
                <p className="text-sm font-medium text-[#e8e9ea]">Kalshi second</p>
                <p className="mt-1 text-xs text-[#9ca3af]">
                  After Polymarket fills, the hedging leg is placed on Kalshi
                  as a GTC limit order at maker pricing (4x cheaper fees).
                </p>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#050608] border border-[#22262d] text-sm font-bold text-[#c0c5cb]">
                3
              </div>
              <div>
                <p className="text-sm font-medium text-[#e8e9ea]">Fallback management</p>
                <p className="mt-1 text-xs text-[#9ca3af]">
                  If the Kalshi leg fails after Polymarket fills, the system
                  manages the one-legged position using exit strategies
                  (stop-loss, take-profit, time-decay).
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Fee Model ─────────────────────────────────────── */}
        <section className="mt-16">
          <h2 className="font-[family-name:var(--font-italiana)] text-2xl font-normal uppercase tracking-[0.08em]">
            Fee Model
          </h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="card-panel rounded-xl p-6">
              <h3 className="font-[family-name:var(--font-cormorant)] text-lg font-medium">
                Kalshi fees
              </h3>
              <p className="mt-2 text-sm text-[#9ca3af]">
                Parabolic fee curve:{" "}
                <span className="font-mono text-[#e8e9ea]">0.07 &times; P &times; (1&minus;P)</span>{" "}
                per contract (taker). Maximum fee of $0.0175 at P = 0.50.
                Maker orders are 4x cheaper.
              </p>
            </div>
            <div className="card-panel rounded-xl p-6">
              <h3 className="font-[family-name:var(--font-cormorant)] text-lg font-medium">
                Polymarket fees
              </h3>
              <p className="mt-2 text-sm text-[#9ca3af]">
                Near-zero fees for standard markets (political, sports).
                Taker fee of 0.01% applies to some market categories. All fee
                calculations are included in edge computation before trade
                qualification.
              </p>
            </div>
          </div>
        </section>

        {/* ── Dashboard ─────────────────────────────────────── */}
        <section className="mt-16">
          <h2 className="font-[family-name:var(--font-italiana)] text-2xl font-normal uppercase tracking-[0.08em]">
            Dashboard
          </h2>
          <p className="mt-4 text-[#9ca3af]">
            The web dashboard provides full visibility into system activity:
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              { tab: "Dashboard", desc: "Portfolio stats, open positions, and live signal feed" },
              { tab: "Automation", desc: "Start/pause trading, kill switch, risk metrics, and recent trade candidates" },
              { tab: "Activity", desc: "Full audit log with filterable event types and CSV export" },
              { tab: "Explore", desc: "Cross-platform market matches with confidence scores" },
              { tab: "Settings", desc: "Exchange connections (Kalshi + Polymarket) and risk profile configuration" },
            ].map((item) => (
              <div
                key={item.tab}
                className="rounded-lg bg-[#0e1117] border border-[#22262d] px-5 py-4"
              >
                <p className="text-sm font-medium text-[#e8e9ea]">{item.tab}</p>
                <p className="mt-1 text-xs text-[#9ca3af]">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────── */}
        <section className="mt-20 text-center">
          <h2 className="font-[family-name:var(--font-italiana)] text-2xl font-normal uppercase tracking-[0.08em]">
            Ready to get started?
          </h2>
          <p className="mt-3 text-[#9ca3af]">
            Join the waitlist for early access.
          </p>
          <div className="mt-6">
            <Link
              href="/#waitlist"
              className="btn-sheen btn-pill inline-flex bg-[#e8e9ea] px-7 py-3 font-medium text-[#050608] transition-colors hover:bg-[#c0c5cb]"
            >
              Request access
            </Link>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-[#1a1d21] py-10">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-6 text-sm text-[#9ca3af] sm:flex-row sm:justify-between">
          <span>&copy; {new Date().getFullYear()} Neutralis.ai</span>
          <ul className="flex gap-6">
            <li>
              <Link
                href="/"
                className="transition-colors hover:text-[#e8e9ea]"
              >
                Home
              </Link>
            </li>
            <li>
              <a
                href="#"
                className="transition-colors hover:text-[#e8e9ea]"
              >
                Privacy
              </a>
            </li>
            <li>
              <a
                href="#"
                className="transition-colors hover:text-[#e8e9ea]"
              >
                Contact
              </a>
            </li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
