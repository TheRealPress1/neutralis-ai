import WaitlistForm from "./waitlist-form";

const outputs = [
  {
    title: "Neutral brief",
    description:
      "A balanced summary with key claims and counterarguments, stripped of loaded framing.",
  },
  {
    title: "Viewpoint comparison",
    description:
      "The strongest arguments across multiple sides, presented with equal weight and clarity.",
  },
  {
    title: "Evidence map",
    description:
      "Each claim scored by source quality and consensus strength — what's solid, uncertain, or missing.",
  },
  {
    title: "Decision memo",
    description:
      "Recommended next steps with assumptions and risks made explicit, ready for your team.",
  },
];

const methodSteps = [
  {
    number: 1,
    title: "Reframe",
    description:
      "Your prompt is rephrased into a neutral, multi-sided inquiry before any analysis begins.",
  },
  {
    number: 2,
    title: "Synthesize",
    description:
      "Evidence is gathered across perspectives and structured with equal weight — no side is favored.",
  },
  {
    number: 3,
    title: "Score",
    description:
      "Claims are ranked by source quality and consensus, surfacing what's well-supported and what's not.",
  },
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
                href="#outputs"
                className="transition-colors hover:text-[#e8e9ea]"
              >
                Outputs
              </a>
            </li>
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
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-[#c0c5cb]">
            Neutral-first AI
          </span>
          <h1 className="mt-4 text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
            Clarity for every&nbsp;decision.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-[#9ca3af]">
            Neutralis produces structured, balanced analysis — neutral briefs,
            viewpoint comparisons, evidence maps — so your team acts on
            signal, not&nbsp;noise.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="#waitlist"
              className="btn-sheen btn-pill inline-flex bg-[#e8e9ea] px-7 py-3 font-medium text-[#050608] transition-colors hover:bg-[#c0c5cb]"
            >
              Request access
            </a>
            <a
              href="#outputs"
              className="btn-pill inline-flex border border-[#1a1d21] px-7 py-3 font-medium transition-colors hover:border-[#c0c5cb]"
            >
              See what it produces
            </a>
          </div>
        </header>
      </div>

      {/* ── Outputs ──────────────────────────────────────── */}
      <section id="outputs" className="border-t border-[#1a1d21] py-24">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight">
            What Neutralis delivers
          </h2>
          <div className="mt-14 grid gap-8 md:grid-cols-2">
            {outputs.map((o) => (
              <article
                key={o.title}
                className="card-panel rounded-xl p-8"
              >
                <h3 className="text-lg font-semibold">{o.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#9ca3af]">
                  {o.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Method ─────────────────────────────────────────── */}
      <section id="method" className="metallic-band border-t border-[#1a1d21] py-24">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight">
            How it works
          </h2>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {methodSteps.map((step) => (
              <article
                key={step.number}
                className="card-panel rounded-xl p-8"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#050608] text-lg font-bold text-[#c0c5cb]">
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
