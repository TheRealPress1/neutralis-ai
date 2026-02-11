import WaitlistForm from "./waitlist-form";
import Navbar from "./navbar";

const capabilities = [
  {
    number: "01",
    title: "Signal detection",
    description:
      "Scans thousands of contracts across Kalshi and Polymarket to find statistically mispriced probabilities in real time.",
  },
  {
    number: "02",
    title: "12-guard risk filter",
    description:
      "Every opportunity passes through 12 independent constraints — correlation limits, liquidity floors, concentration caps — before a dollar moves.",
  },
  {
    number: "03",
    title: "Paper execution",
    description:
      "Orders simulate realistic fills with venue-specific slippage, partial fills, and fee modeling so P&L reflects what live trading would produce.",
  },
  {
    number: "04",
    title: "Portfolio analytics",
    description:
      "Tracks positions, VWAP entry costs, P&L attribution, and win rate across the full book with automatic risk-profile enforcement.",
  },
];

const pipelineSteps = [
  {
    number: 1,
    title: "Scan",
    description:
      "Every tick, the pipeline fetches live markets, normalizes odds across venues, and flags contracts where our models see edge.",
  },
  {
    number: 2,
    title: "Evaluate",
    description:
      "Candidates are scored on edge magnitude, time-to-resolution, ROI per day, and confidence — then filtered through 12 guard constraints.",
  },
  {
    number: 3,
    title: "Execute",
    description:
      "Passing signals are sized by the Kelly criterion, ranked by composite score, and filled through the paper execution engine with slippage simulation.",
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
            Neutralis uses automated quantitative systems to identify
            mis-priced probabilities, manage risk at the portfolio level, and
            execute trades systematically across prediction&nbsp;markets.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="#waitlist"
              className="btn-sheen btn-pill inline-flex bg-[#e8e9ea] px-7 py-3 font-medium text-[#050608] transition-colors hover:bg-[#c0c5cb]"
            >
              Request access
            </a>
            <a
              href="#edge"
              className="btn-pill inline-flex border border-[#1a1d21] px-7 py-3 font-medium transition-colors hover:border-[#c0c5cb]"
            >
              See what it produces
            </a>
          </div>
        </header>
      </div>

      {/* ── Edge ───────────────────────────────────────────── */}
      <section id="edge" className="border-t border-[#1a1d21] py-32">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center font-[family-name:var(--font-italiana)] text-3xl font-normal uppercase tracking-[0.08em] sm:text-4xl">
            The Neutralis Edge
          </h2>
          <p className="mt-3 text-center text-sm tracking-wide text-[#9ca3af]">
            Systematic alpha across prediction markets
          </p>
          <div className="mt-14 grid gap-8 md:grid-cols-2">
            {capabilities.map((c) => (
              <article
                key={c.number}
                className="card-panel card-accent rounded-xl p-8"
              >
                <span className="font-[family-name:var(--font-geist-mono)] text-xs tracking-widest text-[#9ca3af]">
                  {c.number}
                </span>
                <h3 className="mt-2 text-lg font-semibold">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#9ca3af]">
                  {c.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pipeline ──────────────────────────────────────── */}
      <section id="pipeline" className="border-t border-[#1a1d21] py-32">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center font-[family-name:var(--font-italiana)] text-3xl font-normal uppercase tracking-[0.08em] sm:text-4xl">
            How the pipeline works
          </h2>
          <p className="mt-3 text-center text-sm tracking-wide text-[#9ca3af]">
            From raw odds to optimized positions in under a minute
          </p>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {pipelineSteps.map((step) => (
              <article
                key={step.number}
                className="card-panel card-accent rounded-xl p-8"
              >
                <span className="font-[family-name:var(--font-geist-mono)] text-xs tracking-widest text-[#9ca3af]">
                  {String(step.number).padStart(2, "0")}
                </span>
                <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#9ca3af]">
                  {step.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Waitlist ────────────────────────────────────────── */}
      <section id="waitlist" className="border-t border-[#1a1d21] py-32">
        <div className="mx-auto flex max-w-xl flex-col items-center px-6 text-center">
          <h2 className="font-[family-name:var(--font-italiana)] text-3xl font-normal uppercase tracking-[0.08em] sm:text-4xl">
            Get early access
          </h2>
          <p className="mt-4 text-[#9ca3af]">
            Join the waitlist to get notified when Neutralis opens its
            first&nbsp;fund.
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
