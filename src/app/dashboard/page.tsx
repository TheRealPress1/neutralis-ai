import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SubscriptionTier } from "@/lib/subscription";
import DashboardShell from "./components/DashboardShell";

export const metadata: Metadata = {
  title: "Dashboard | Neutralis.ai",
  description:
    "Portfolio monitoring dashboard for Neutralis.ai event hedge fund",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/dashboard");
  }

  // Fetch subscription tier server-side (avoids client-side race/failure)
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("subscription_tier, is_founder")
    .eq("id", user.id)
    .single();

  const isFounder = profile?.is_founder === true;
  const tier: SubscriptionTier = isFounder
    ? "pro"
    : ((profile?.subscription_tier as SubscriptionTier) ?? "free");

  // Check which exchange keys are configured
  const { data: apiKeys } = await supabase
    .from("user_api_keys")
    .select("platform")
    .eq("user_id", user.id);

  const platforms = (apiKeys ?? []).map(
    (k: { platform: string }) => k.platform,
  );
  const hasKalshi = platforms.includes("kalshi");
  const hasPoly = platforms.includes("polymarket");
  const hasPolyWallet = platforms.includes("polymarket_wallet");
  const hasApiKeys = hasKalshi || hasPoly;
  const hasBothVenues = hasKalshi && hasPoly && hasPolyWallet;

  return (
    <DashboardShell
      initialTier={tier}
      initialIsFounder={isFounder}
      initialHasApiKeys={hasApiKeys}
      initialHasBothVenues={hasBothVenues}
      initialHasKalshi={hasKalshi}
      initialHasPoly={hasPoly && hasPolyWallet}
    />
  );
}
