"use client";

import RiskProfileEditor from "./RiskProfileEditor";
import UpgradeBanner from "./UpgradeBanner";
import AccessCodeGenerator from "./AccessCodeGenerator";
import { hasAccess, type SubscriptionTier } from "@/app/actions/subscription";

export default function SettingsPage({
  tier,
  isFounder,
}: {
  tier: SubscriptionTier;
  isFounder: boolean;
}) {
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

      {isFounder && <AccessCodeGenerator />}
    </div>
  );
}
