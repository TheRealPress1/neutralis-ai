import Navbar from "./navbar";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

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
            <Link
              href={signedIn ? "/dashboard" : "/signup"}
              className="btn-sheen btn-pill inline-flex bg-[#e8e9ea] px-7 py-3 font-medium text-[#050608] transition-colors hover:bg-[#c0c5cb]"
            >
              {signedIn ? "Go to Dashboard" : "Get started"}
            </Link>
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

      {/* ── Pricing ─────────────────────────────────────────── */}
      <section id="pricing" className="border-t border-[#1a1d21] py-24">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl font-[family-name:var(--font-italiana)] font-normal uppercase tracking-[0.08em]">
            Simple pricing
          </h2>
          <p className="mt-4 text-center text-[#9ca3af]">
            Start free. Upgrade when you&apos;re ready to trade.
          </p>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {/* Free */}
            <div className="rounded-xl border border-[#1a1d21] bg-[#0a0c0f] p-6 flex flex-col">
              <h3 className="text-lg font-medium">Free</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-semibold">$0</span>
              </div>
              <p className="mt-2 text-sm text-[#9ca3af]">
                Explore signals and matched pairs.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-[#c8ccd2] flex-1">
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">&#10003;</span> Live signals & matched pairs
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">&#10003;</span> Market explorer
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">&#10003;</span> Basic analytics
                </li>
              </ul>
              <Link
                href={signedIn ? "/dashboard" : "/signup"}
                className="mt-6 block rounded-lg border border-[#1a1d21] px-4 py-2.5 text-center text-sm font-medium transition-colors hover:border-[#e8e9ea]/30 hover:bg-[#1a1d21]"
              >
                {signedIn ? "Go to Dashboard" : "Get started"}
              </Link>
            </div>

            {/* Starter */}
            <div className="relative rounded-xl border border-[#e8e9ea]/30 bg-[#0a0c0f] p-6 flex flex-col">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#e8e9ea] px-3 py-0.5 text-xs font-medium text-[#050608]">
                Most popular
              </span>
              <h3 className="text-lg font-medium">Starter</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-semibold">$9.99</span>
                <span className="text-sm text-[#9ca3af]">/mo</span>
              </div>
              <p className="mt-2 text-sm text-[#9ca3af]">
                Automated execution with risk guards.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-[#c8ccd2] flex-1">
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">&#10003;</span> Everything in Free
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">&#10003;</span> Automated trade execution
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">&#10003;</span> Basic risk configuration
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">&#10003;</span> 20% performance fee
                </li>
              </ul>
              <Link
                href="/pricing"
                className="mt-6 block rounded-lg bg-[#e8e9ea] px-4 py-2.5 text-center text-sm font-medium text-[#050608] transition-colors hover:bg-[#c0c5cb]"
              >
                Upgrade to Starter
              </Link>
            </div>

            {/* Pro */}
            <div className="rounded-xl border border-[#1a1d21] bg-[#0a0c0f] p-6 flex flex-col">
              <h3 className="text-lg font-medium">Pro</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-semibold">$19.99</span>
                <span className="text-sm text-[#9ca3af]">/mo</span>
              </div>
              <p className="mt-2 text-sm text-[#9ca3af]">
                Full control with maker orders and lower fees.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-[#c8ccd2] flex-1">
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">&#10003;</span> Everything in Starter
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">&#10003;</span> Maker orders (4x cheaper)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">&#10003;</span> Full risk customization
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">&#10003;</span> 10% performance fee
                </li>
              </ul>
              <Link
                href="/pricing"
                className="mt-6 block rounded-lg border border-[#1a1d21] px-4 py-2.5 text-center text-sm font-medium transition-colors hover:border-[#e8e9ea]/30 hover:bg-[#1a1d21]"
              >
                Upgrade to Pro
              </Link>
            </div>
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
