import WaitlistForm from "./waitlist-form";

const features = [
  {
    title: "Balanced by design",
    description:
      "Every response is weighted for fairness. Neutralis surfaces multiple perspectives so your team sees the full picture — not just the loudest angle.",
  },
  {
    title: "Transparent reasoning",
    description:
      "See why the model reached its conclusion. Neutralis shows its work, so you can verify the logic before you act on it.",
  },
  {
    title: "Calm under pressure",
    description:
      "No sensationalism, no urgency theater. Neutralis keeps a steady tone — even when the stakes are high — so your team stays focused.",
  },
];

const methodSteps = [
  {
    number: 1,
    title: "Frame neutrally",
    description:
      "Neutralis strips loaded framing and rephrases your prompt into a balanced, multi-sided inquiry.",
  },
  {
    number: 2,
    title: "Compare perspectives",
    description:
      "The model gathers evidence across viewpoints and presents them with equal weight and clarity.",
  },
  {
    number: 3,
    title: "Weight evidence & uncertainty",
    description:
      "Each claim is scored by source quality and consensus strength, highlighting what's well-supported and what's uncertain.",
  },
];

const methodChips = [
  "Neutral framing",
  "Multi-view synthesis",
  "Evidence weighting",
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#050608] text-[#e8e9ea]">
      {/* ── Nav ────────────────────────────────────────────── */}
      <nav className="fixed top-0 z-50 w-full border-b border-[#1a1d21] bg-[#050608]/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <a href="#" className="text-lg font-semibold tracking-tight">
            Neutralis.ai
          </a>
          <ul className="hidden gap-6 text-sm font-medium text-[#9ca3af] sm:flex">
            <li>
              <a
                href="#method"
                className="transition-colors hover:text-[#e8e9ea]"
              >
                Method
              </a>
            </li>
            <li>
              <a
                href="#product"
                className="transition-colors hover:text-[#e8e9ea]"
              >
                Product
              </a>
            </li>
            <li>
              <a
                href="#waitlist"
                className="transition-colors hover:text-[#e8e9ea]"
              >
                Waitlist
              </a>
            </li>
          </ul>
          <a
            href="#waitlist"
            className="btn-sheen btn-pill bg-[#e8e9ea] px-5 py-2 text-sm font-medium text-[#050608] transition-colors hover:bg-[#c0c5cb]"
          >
            Request access
          </a>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────── */}
      <div className="hero-glow flex min-h-screen items-center justify-center">
        <header className="relative z-10 mx-auto max-w-3xl px-6 text-center">
          <h1 className="text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
            Neutral-first AI for clear&nbsp;decisions.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-[#9ca3af]">
            Balanced viewpoints. Evidence weighting. Calm interface. Neutralis
            removes the noise so your team sees what&nbsp;matters.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="#waitlist"
              className="btn-sheen btn-pill inline-flex bg-[#e8e9ea] px-7 py-3 font-medium text-[#050608] transition-colors hover:bg-[#c0c5cb]"
            >
              Request access
            </a>
            <a
              href="#method"
              className="btn-pill inline-flex border border-[#1a1d21] px-7 py-3 font-medium transition-colors hover:border-[#c0c5cb]"
            >
              See the method
            </a>
          </div>

          {/* Method preview chips */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {methodChips.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-[#1a1d21] px-4 py-1.5 text-xs text-[#9ca3af]"
              >
                {chip}
              </span>
            ))}
          </div>
        </header>
      </div>

      {/* ── Method ─────────────────────────────────────────── */}
      <section id="method" className="metallic-band border-t border-[#1a1d21] py-24">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight">
            How neutrality works
          </h2>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {methodSteps.map((step) => (
              <article
                key={step.number}
                className="glass-card glass-card-hover rounded-xl p-8"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#0a0d10] text-lg font-bold text-[#c0c5cb]">
                  {step.number}
                </div>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#9ca3af]">
                  {step.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Product ────────────────────────────────────────── */}
      <section id="product" className="border-t border-[#1a1d21] py-24">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight">
            Built for thoughtful teams
          </h2>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {features.map((f) => (
              <article
                key={f.title}
                className="glass-card glass-card-hover rounded-xl p-8"
              >
                <h3 className="text-lg font-semibold">{f.title}</h3>
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
          <h2 className="text-3xl font-bold tracking-tight">
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
