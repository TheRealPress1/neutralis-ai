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
        <div className="mb-8 rounded-lg border border-neon-green/20 bg-neon-green/10 px-5 py-4 text-center text-sm text-neon-green">
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
                  ? "border-text-primary/30 bg-bg-secondary"
                  : "border-border bg-bg-secondary"
              }`}
            >
              {isPopular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-text-primary px-3 py-0.5 text-xs font-medium text-bg-primary">
                  Most popular
                </span>
              )}

              <div className="mb-5">
                <h3 className="text-lg font-medium text-text-primary">
                  {plan.name}
                </h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold text-text-primary">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-sm text-text-secondary">{plan.period}</span>
                  )}
                </div>
                <p className="mt-2 text-sm text-text-secondary">{plan.description}</p>
              </div>

              <ul className="space-y-2.5 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-neon-green"
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
                    <span className="text-text-mono">{f}</span>
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="rounded-lg border border-border bg-bg-elevated px-4 py-2.5 text-center text-sm font-medium text-text-secondary">
                  Current plan
                </div>
              ) : (
                <button
                  onClick={() => handleSelect(plan.id)}
                  disabled={isPending}
                  className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                    isPopular
                      ? "bg-text-primary text-bg-primary hover:bg-text-mono"
                      : "border border-border bg-bg-elevated text-text-primary hover:border-text-primary/30 hover:bg-border"
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
