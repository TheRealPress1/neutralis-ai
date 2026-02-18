import WaitlistForm from "./waitlist-form";
import Navbar from "./navbar";
import Link from "next/link";

const features = [
  {
    title: "Cross-platform arb detection",
    description:
      "Continuously scans Kalshi and Polymarket for mispriced probabilities. When the same event trades at different prices across venues, Neutralis finds the edge.",
  },
  {
    title: "Automated execution",
    description:
      "Trades execute in milliseconds via real-time WebSocket connections. Maker orders minimize fees, and cross-platform hedging locks in arbitrage spreads.",
  },
  {
    title: "Portfolio risk management",
    description:
      "Position sizing, exposure limits, stop-losses, and daily drawdown caps — all enforced automatically before every trade.",
  },
  {
    title: "Real-time dashboard",
    description:
      "Monitor positions, signals, and execution from a live dashboard. Every decision is logged with full guard transparency.",
  },
];


export default function Home() {
  return (
    <div className="min-h-screen bg-[#050608] text-[#e8e9ea]">
      {/* ── Nav ────────────────────────────────────────────── */}
      <Navbar />

      {/* ── Hero ───────────────────────────────────────────── */}
      <div className="hero-glow flex min-h-screen items-center justify-center">
        <header className="relative z-10 mx-auto max-w-3xl px-6 text-center">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-[#e0e1e3]">
            Neutralis AI
          </span>
          <h1 className="mt-4 text-center">
            <span className="block font-[family-name:var(--font-italiana)] text-4xl font-normal uppercase leading-[1.15] tracking-[0.14em] text-[#f0f0f0] sm:text-5xl">
              The modern hedge fund for
            </span>
            <span className="headline-italic block font-[family-name:var(--font-cormorant)] text-5xl font-medium italic uppercase leading-[1.1] tracking-[0.08em] text-[#f5f5f5] sm:text-6xl">
              Prediction Markets
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-[#c8ccd2]">
            Neutralis detects arbitrage across prediction markets in real time,
            evaluates every trade through quantitative risk guards, and executes
            automatically — so you capture edge without watching&nbsp;screens.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="#waitlist"
              className="btn-sheen btn-pill inline-flex bg-[#e8e9ea] px-7 py-3 font-medium text-[#050608] transition-colors hover:bg-[#c0c5cb]"
            >
              Request access
            </a>
            <Link
              href="/docs"
              className="btn-pill inline-flex border border-[#1a1d21] px-7 py-3 font-medium transition-colors hover:border-[#c0c5cb]"
            >
              How it works
            </Link>
          </div>
        </header>
      </div>

      {/* ── Features ──────────────────────────────────────── */}
      <section id="features" className="border-t border-[#1a1d21] py-24">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl font-[family-name:var(--font-italiana)] font-normal uppercase tracking-[0.08em]">
            What you get
          </h2>
          <div className="mt-14 grid gap-8 md:grid-cols-2">
            {features.map((f) => (
              <article
                key={f.title}
                className="card-panel rounded-xl p-8"
              >
                <h3 className="font-[family-name:var(--font-cormorant)] text-xl font-medium">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#9ca3af]">
                  {f.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Waitlist ────────────────────────────────────────── */}
      <section id="waitlist" className="border-t border-[#1a1d21] py-24">
        <div className="mx-auto flex max-w-xl flex-col items-center px-6 text-center">
          <h2 className="text-3xl font-[family-name:var(--font-italiana)] font-normal uppercase tracking-[0.08em]">
            Get early access
          </h2>
          <p className="mt-4 text-[#9ca3af]">
            Join the waitlist and we&apos;ll let you know when Neutralis is
            ready.
          </p>
          <div className="mt-8 w-full">
            <WaitlistForm />
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-[#1a1d21] py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 text-sm text-[#9ca3af] sm:flex-row sm:justify-between">
          <span>&copy; {new Date().getFullYear()} Neutralis.ai</span>
          <ul className="flex gap-6">
            <li>
              <Link
                href="/docs"
                className="transition-colors hover:text-[#e8e9ea]"
              >
                How it Works
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
