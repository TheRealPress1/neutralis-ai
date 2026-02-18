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

  return <DashboardShell initialTier={tier} initialIsFounder={isFounder} />;
}
