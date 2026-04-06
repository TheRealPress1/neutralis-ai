import Navbar from "./navbar";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import StatsTicker from "./components/landing/StatsTicker";
import PipelineViz from "./components/landing/PipelineViz";
import TerminalDemo from "./components/landing/TerminalDemo";

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


export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const signedIn = !!user;
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {/* ── Nav ────────────────────────────────────────────── */}
      <Navbar />

      {/* ── Hero ───────────────────────────────────────────── */}
      <div className="hero-glow flex min-h-screen items-center justify-center">
        <header className="relative z-10 mx-auto max-w-3xl px-6 text-center">
          <span className="font-mono text-xs font-medium uppercase tracking-[0.25em] text-neon-green/80">
            Neutralis AI
          </span>
          <h1 className="mt-4 text-center">
            <span className="block font-[family-name:var(--font-italiana)] text-4xl font-normal uppercase leading-[1.15] tracking-[0.14em] text-text-primary sm:text-5xl">
              The modern hedge fund for
            </span>
            <span className="headline-italic block font-[family-name:var(--font-cormorant)] text-5xl font-medium italic uppercase leading-[1.1] tracking-[0.08em] text-text-primary sm:text-6xl">
              Prediction Markets
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-text-secondary">
            Neutralis detects arbitrage across prediction markets in real time,
            evaluates every trade through quantitative risk guards, and executes
            automatically — so you capture edge without watching&nbsp;screens.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href={signedIn ? "/dashboard" : "/signup"}
              className="btn-sheen btn-pill inline-flex border border-neon-green/50 bg-neon-green/10 px-7 py-3 font-mono font-medium text-neon-green transition-all hover:bg-neon-green/20 hover:shadow-[0_0_20px_rgba(0,255,170,0.15)]"
            >
              {signedIn ? "Go to Dashboard" : "Get started"}
            </Link>
            <Link
              href="/docs"
              className="btn-pill inline-flex border border-border px-7 py-3 font-mono font-medium text-text-secondary transition-all hover:border-neon-blue/30 hover:text-neon-blue"
            >
              How it works
            </Link>
          </div>
        </header>
      </div>

      {/* ── Stats Ticker ────────────────────────────────────── */}
      <StatsTicker />

      {/* ── Pipeline Visualization ──────────────────────────── */}
      <PipelineViz />

      {/* ── Features ──────────────────────────────────────── */}
      <section id="features" className="border-t border-border py-24">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl font-[family-name:var(--font-italiana)] font-normal uppercase tracking-[0.08em] text-text-primary">
            What you get
          </h2>
          <div className="mt-14 grid gap-8 md:grid-cols-2">
            {features.map((f) => (
              <article
                key={f.title}
                className="hud-panel p-8"
              >
                <h3 className="font-[family-name:var(--font-cormorant)] text-xl font-medium text-text-primary">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                  {f.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Terminal Demo ───────────────────────────────────── */}
      <TerminalDemo />

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 text-sm text-text-secondary sm:flex-row sm:justify-between">
          <span className="flex items-center gap-2">
            &copy; {new Date().getFullYear()} Neutralis.ai
            <a href="mailto:neutralis.ai@gmail.com" className="text-text-secondary transition-colors hover:text-text-primary" aria-label="Email us">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            </a>
          </span>
          <ul className="flex gap-6">
            <li>
              <Link
                href="/docs"
                className="transition-colors hover:text-text-primary"
              >
                How it Works
              </Link>
            </li>
            <li>
              <a
                href="#"
                className="transition-colors hover:text-text-primary"
              >
                Privacy
              </a>
            </li>
            <li>
              <a
                href="mailto:neutralis.ai@gmail.com"
                className="transition-colors hover:text-text-primary"
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
