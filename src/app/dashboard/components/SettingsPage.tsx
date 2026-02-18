"use client";

import RiskProfileEditor from "./RiskProfileEditor";
import UpgradeBanner from "./UpgradeBanner";
import type { SubscriptionTier } from "@/app/actions/subscription";

export default function SettingsPage({ tier }: { tier: SubscriptionTier }) {
  return (
    <div className="space-y-8">
      {tier === "free" ? (
        <UpgradeBanner
          feature="Risk profile customization"
          requiredTier="starter"
        />
      ) : (
        <RiskProfileEditor />
      )}
    </div>
  );
}
