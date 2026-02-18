import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AuthNav from "@/app/components/AuthNav";
import PricingCards from "./components/PricingCards";
import RedeemCode from "./components/RedeemCode";

export const metadata: Metadata = {
  title: "Pricing | Neutralis.ai",
  description: "Choose a plan that fits your trading needs.",
};

const plans = [
  {
    id: "free" as const,
    name: "Free",
    price: "$0",
    period: "",
    description: "Explore signals and matched pairs across platforms.",
    features: [
      "View live signals & matched pairs",
      "Cross-platform market explorer",
      "Basic dashboard analytics",
    ],
    cta: "Get started",
  },
  {
    id: "starter" as const,
    name: "Starter",
    price: "$9.99",
    period: "/mo",
    description: "Automated execution with quantitative risk guards.",
    features: [
      "Everything in Free",
      "Automated trade execution",
      "Basic risk configuration",
      "Taker orders (FOK)",
      "20% performance fee on profits",
    ],
    cta: "Upgrade to Starter",
    popular: true,
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "$19.99",
    period: "/mo",
    description: "Full control with maker orders and lower fees.",
    features: [
      "Everything in Starter",
      "Maker orders (GTC) — 4x cheaper fees",
      "Full risk profile customization",
      "Priority execution",
      "10% performance fee on profits",
    ],
    cta: "Upgrade to Pro",
  },
];

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentTier = "free";
  if (user) {
    const { data } = await (supabase as any)
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .single();
    currentTier = data?.subscription_tier ?? "free";
  }

  return (
    <div className="min-h-screen bg-[#050608] text-[#e8e9ea]">
      <nav className="fixed top-0 z-50 w-full border-b border-[#22262d] bg-[#08090c]/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="font-[family-name:var(--font-italiana)] text-xl font-normal tracking-[0.08em] text-white/90"
          >
            Neutralis.ai
          </Link>
          <ul className="flex items-center gap-4 text-sm">
            <AuthNav />
          </ul>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-6 pt-28 pb-20">
        <div className="text-center mb-14">
          <h1 className="text-3xl font-[family-name:var(--font-italiana)] font-normal uppercase tracking-[0.08em] sm:text-4xl">
            Choose your plan
          </h1>
          <p className="mt-4 text-[#9ca3af] max-w-lg mx-auto">
            Start free with signal monitoring. Upgrade to unlock automated
            execution and lower fees.
          </p>
        </div>

        <PricingCards
          plans={plans}
          currentTier={currentTier}
          signedIn={!!user}
        />

        {user && <RedeemCode />}
      </main>
    </div>
  );
}
