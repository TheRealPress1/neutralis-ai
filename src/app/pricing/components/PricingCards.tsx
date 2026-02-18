"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { selectPlan } from "@/app/actions/subscription";
import type { SubscriptionTier } from "@/lib/subscription";

interface Plan {
  id: SubscriptionTier;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  popular?: boolean;
}

export default function PricingCards({
  plans,
  currentTier,
  signedIn,
}: {
  plans: Plan[];
  currentTier: string;
  signedIn: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSuccess = searchParams.get("success") === "true";

  function handleSelect(tier: SubscriptionTier) {
    if (!signedIn) {
      router.push("/signup");
      return;
    }
    startTransition(async () => {
      const result = await selectPlan(tier);
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else if (!result.error) {
        router.refresh();
      }
    });
  }

  return (
    <>
      {isSuccess && (
        <div className="mb-8 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-center text-sm text-emerald-400">
          Subscription activated! Your plan has been upgraded.
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = currentTier === plan.id;
          const isPopular = plan.popular;

          return (
            <div
              key={plan.id}
              className={`relative rounded-xl border p-6 flex flex-col ${
                isPopular
                  ? "border-[#e8e9ea]/30 bg-[#0e1117]"
                  : "border-[#22262d] bg-[#0e1117]"
              }`}
            >
              {isPopular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#e8e9ea] px-3 py-0.5 text-xs font-medium text-[#050608]">
                  Most popular
                </span>
              )}

              <div className="mb-5">
                <h3 className="text-lg font-medium text-[#eceef0]">
                  {plan.name}
                </h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold text-[#eceef0]">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-sm text-[#9ca3af]">{plan.period}</span>
                  )}
                </div>
                <p className="mt-2 text-sm text-[#9ca3af]">{plan.description}</p>
              </div>

              <ul className="space-y-2.5 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m4.5 12.75 6 6 9-13.5"
                      />
                    </svg>
                    <span className="text-[#c8ccd2]">{f}</span>
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="rounded-lg border border-[#22262d] bg-[#1a1d21] px-4 py-2.5 text-center text-sm font-medium text-[#9ca3af]">
                  Current plan
                </div>
              ) : (
                <button
                  onClick={() => handleSelect(plan.id)}
                  disabled={isPending}
                  className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                    isPopular
                      ? "bg-[#e8e9ea] text-[#050608] hover:bg-[#c0c5cb]"
                      : "border border-[#22262d] bg-[#1a1d21] text-[#e8e9ea] hover:border-[#e8e9ea]/30 hover:bg-[#22262d]"
                  }`}
                >
                  {isPending ? "Updating..." : plan.cta}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
