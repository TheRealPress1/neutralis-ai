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
    title: "Reframe the question",
    description:
      "Neutralis strips loaded framing and rephrases your prompt into a neutral, multi-sided inquiry — before any analysis begins.",
  },
  {
    number: 2,
    title: "Synthesize multiple views",
    description:
      "Instead of picking a side, the model gathers evidence across perspectives and presents them with equal weight and clarity.",
  },
  {
    number: 3,
    title: "Weight the evidence",
    description:
      "Each claim is scored by source quality and consensus strength, so you can see which conclusions rest on solid ground.",
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
          <ul className="flex gap-6 text-sm font-medium text-[#9ca3af]">
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
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────── */}
      <header className="hero-sheen mx-auto max-w-3xl px-6 pb-24 pt-36 text-center">
        <h1 className="text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
          AI that stays neutral
          <br />
          so you can think clearly
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-[#9ca3af]">
          Neutralis helps teams make better decisions with balanced, transparent
          AI. No hype, no hidden agendas — just clarity when it matters most.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="#waitlist"
            className="btn-sheen inline-flex rounded-lg bg-[#e8e9ea] px-6 py-3 font-medium text-[#050608] transition-colors hover:bg-[#c0c5cb]"
          >
            Request access
          </a>
          <a
            href="#method"
            className="inline-flex rounded-lg border border-[#1a1d21] px-6 py-3 font-medium transition-colors hover:border-[#c0c5cb]"
          >
            See how it works
          </a>
        </div>
      </header>

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
