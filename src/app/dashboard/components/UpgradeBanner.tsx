"use client";

import Link from "next/link";

interface UpgradeBannerProps {
  feature: string;
  requiredTier: "starter" | "pro";
}

const TIER_LABELS: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
};

export default function UpgradeBanner({
  feature,
  requiredTier,
}: UpgradeBannerProps) {
  return (
    <div className="relative rounded-xl border border-[#22262d] bg-[#0e1117] p-8">
      <div className="flex flex-col items-center text-center py-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1a1d21] border border-[#22262d] mb-4">
          <svg
            className="h-6 w-6 text-[#9ca3af]"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-[#eceef0]">
          {feature} requires {TIER_LABELS[requiredTier]}
        </h3>
        <p className="mt-2 max-w-sm text-sm text-[#9ca3af]">
          Upgrade to the {TIER_LABELS[requiredTier]} plan to unlock {feature.toLowerCase()}.
        </p>
        <Link
          href="/pricing"
          className="mt-5 rounded-lg bg-[#e8e9ea] px-6 py-2.5 text-sm font-medium text-[#050608] hover:bg-[#c0c5cb] transition-colors"
        >
          View plans
        </Link>
      </div>
    </div>
  );
}
