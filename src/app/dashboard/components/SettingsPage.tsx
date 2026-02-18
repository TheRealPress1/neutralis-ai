"use client";

import RiskProfileEditor from "./RiskProfileEditor";
import UpgradeBanner from "./UpgradeBanner";
import { hasAccess, type SubscriptionTier } from "@/lib/subscription";

export default function SettingsPage({ tier }: { tier: SubscriptionTier }) {
  return (
    <div className="space-y-8">
      {!hasAccess(tier, "starter") ? (
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
