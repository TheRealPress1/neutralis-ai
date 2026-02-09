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

const faqs = [
  {
    q: "What makes Neutralis different from other AI tools?",
    a: "Most AI products optimize for engagement. Neutralis optimizes for clarity. We reduce bias in outputs, show reasoning transparently, and keep a measured tone by default.",
  },
  {
    q: "Who is Neutralis built for?",
    a: "Teams that make consequential decisions — in policy, research, finance, healthcare, and beyond. Anyone who needs AI they can trust to stay level-headed.",
  },
  {
    q: "Is there a free tier?",
    a: "We plan to offer a generous free tier at launch. Join the waitlist to be the first to know when we open access.",
  },
  {
    q: "When will Neutralis be available?",
    a: "We are in private development. Early access will roll out to waitlist members first. Sign up above and we will keep you updated.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* ── Nav ────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <a href="#" className="text-lg font-semibold tracking-tight">
            Neutralis.ai
          </a>
          <ul className="flex gap-6 text-sm font-medium text-zinc-600 dark:text-zinc-400">
            <li>
              <a href="#features" className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100">
                Features
              </a>
            </li>
            <li>
              <a href="#faq" className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100">
                FAQ
              </a>
            </li>
            <li>
              <a href="#waitlist" className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100">
                Waitlist
              </a>
            </li>
          </ul>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────── */}
      <header className="mx-auto max-w-3xl px-6 pb-24 pt-32 text-center">
        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          AI that stays neutral&nbsp;so&nbsp;you&nbsp;can think&nbsp;clearly
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
          Neutralis helps teams make better decisions with balanced, transparent
          AI. No hype, no hidden agendas — just clarity when it matters most.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="#waitlist"
            className="inline-flex rounded-lg bg-zinc-900 px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus:ring-offset-zinc-950"
          >
            Join the waitlist
          </a>
          <a
            href="#features"
            className="inline-flex rounded-lg border border-zinc-300 px-6 py-3 font-medium transition-colors hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 dark:border-zinc-700 dark:hover:bg-zinc-800 dark:focus:ring-offset-zinc-950"
          >
            Learn more
          </a>
        </div>
      </header>

      {/* ── Features ───────────────────────────────────────── */}
      <section
        id="features"
        className="border-t border-zinc-200 bg-zinc-50 py-24 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight">
            Built for thoughtful teams
          </h2>
          <div className="mt-14 grid gap-8 sm:grid-cols-3">
            {features.map((f) => (
              <article
                key={f.title}
                className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800"
              >
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {f.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────── */}
      <section id="faq" className="border-t border-zinc-200 py-24 dark:border-zinc-800">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight">
            Frequently asked questions
          </h2>
          <dl className="mt-14 space-y-6">
            {faqs.map((item) => (
              <div
                key={item.q}
                className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-700"
              >
                <dt className="font-semibold">{item.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Waitlist ────────────────────────────────────────── */}
      <section
        id="waitlist"
        className="border-t border-zinc-200 bg-zinc-50 py-24 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="mx-auto flex max-w-xl flex-col items-center px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Get early access
          </h2>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">
            Join the waitlist and we&apos;ll let you know when Neutralis is
            ready.
          </p>
          <div className="mt-8 w-full">
            <WaitlistForm />
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-zinc-200 py-10 dark:border-zinc-800">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 text-sm text-zinc-500 sm:flex-row sm:justify-between">
          <span>&copy; {new Date().getFullYear()} Neutralis.ai</span>
          <ul className="flex gap-6">
            <li>
              <a href="#features" className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100">
                Features
              </a>
            </li>
            <li>
              <a href="#faq" className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100">
                FAQ
              </a>
            </li>
            <li>
              <a href="#waitlist" className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100">
                Waitlist
              </a>
            </li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
