import Navbar from "./navbar";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import MeshGradient from "./components/landing/MeshGradient";
import TypewriterHero from "./components/landing/TypewriterHero";
import MarketTicker from "./components/landing/MarketTicker";
import StatsTicker from "./components/landing/StatsTicker";
import PipelineViz from "./components/landing/PipelineViz";
import FeaturesGrid from "./components/landing/FeaturesGrid";
import TerminalDemo from "./components/landing/TerminalDemo";
import ScrollReveal from "./components/landing/ScrollReveal";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const signedIn = !!user;
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {/* ── Nav ────────────────────────────────────────────── */}
      <Navbar />

      {/* ── Hero ───────────────────────────────────────────── */}
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
        {/* Animated mesh gradient background */}
        <MeshGradient />

        <header className="relative z-10 mx-auto max-w-3xl px-6 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-neon-green/20 bg-neon-green/5 px-4 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-neon-green/90">
            <span className="h-1.5 w-1.5 rounded-full bg-neon-green neon-pulse" />
            Engine Active
          </span>
          <h1 className="mt-8 text-center">
            <span className="block font-[family-name:var(--font-italiana)] text-4xl font-normal uppercase leading-[1.15] tracking-[0.14em] text-text-primary sm:text-5xl md:text-6xl">
              Real-time arbitrage alerts for
            </span>
            <span className="headline-italic mt-2 block font-[family-name:var(--font-cormorant)] text-5xl font-medium italic uppercase leading-[1.1] tracking-[0.08em] text-text-primary sm:text-6xl md:text-7xl">
              <TypewriterHero />
            </span>
          </h1>
          <p className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-text-secondary sm:text-lg">
            Neutralis scans thousands of markets across Kalshi and Polymarket,
            scores every opportunity through quantitative risk guards, and
            alerts you the moment edge appears — trade it yourself, or let
            Neutralis auto-execute.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href={signedIn ? "/dashboard" : "/signup"}
              className="btn-sheen btn-pill group relative inline-flex items-center gap-2 border border-neon-green/50 bg-neon-green/10 px-8 py-3.5 font-mono font-medium text-neon-green transition-all hover:bg-neon-green/20 hover:shadow-[0_0_30px_rgba(0,255,170,0.15)]"
            >
              {signedIn ? "Go to Dashboard" : "Start free"}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 transition-transform group-hover:translate-x-0.5">
                <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
              </svg>
            </Link>
            <Link
              href="/docs"
              className="btn-pill inline-flex border border-border px-8 py-3.5 font-mono font-medium text-text-secondary transition-all hover:border-neon-blue/30 hover:text-neon-blue"
            >
              How it works
            </Link>
          </div>

          {/* Social proof line */}
          <p className="mt-12 font-mono text-[10px] uppercase tracking-[0.2em] text-text-secondary/60">
            Free to start · Scanning 3,200+ markets across Kalshi & Polymarket
          </p>
        </header>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-bg-primary to-transparent" />
      </div>

      {/* ── Market Ticker ──────────────────────────────────── */}
      <MarketTicker />

      {/* ── Stats Ticker ────────────────────────────────────── */}
      <StatsTicker />

      {/* ── Pipeline Visualization ──────────────────────────── */}
      <PipelineViz />

      {/* ── Features ──────────────────────────────────────── */}
      <FeaturesGrid />

      {/* ── Terminal Demo ───────────────────────────────────── */}
      <TerminalDemo />

      {/* ── CTA Section ─────────────────────────────────────── */}
      <section className="border-t border-border py-24">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <ScrollReveal>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.3em] text-neon-green/60">
              Free to start
            </p>
            <h2 className="mt-4 font-[family-name:var(--font-italiana)] text-3xl font-normal uppercase tracking-[0.08em] text-text-primary sm:text-4xl">
              See the edge for yourself
            </h2>
            <p className="mt-4 text-text-secondary">
              Sign up free and watch live arbitrage signals stream in. Upgrade when you want auto-execution — your trades, your accounts, your capital.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href={signedIn ? "/dashboard" : "/signup"}
                className="btn-sheen btn-pill inline-flex items-center gap-2 border border-neon-green/50 bg-neon-green/10 px-8 py-3.5 font-mono font-medium text-neon-green transition-all hover:bg-neon-green/20 hover:shadow-[0_0_30px_rgba(0,255,170,0.15)]"
              >
                {signedIn ? "Open Dashboard" : "Start free"}
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

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
              <Link href="/docs" className="transition-colors hover:text-text-primary">
                How it Works
              </Link>
            </li>
            <li>
              <a href="#" className="transition-colors hover:text-text-primary">
                Privacy
              </a>
            </li>
            <li>
              <a href="mailto:neutralis.ai@gmail.com" className="transition-colors hover:text-text-primary">
                Contact
              </a>
            </li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
