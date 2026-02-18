"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SubscriptionTier = "free" | "starter" | "pro" | "founder";

const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  founder: 99,
};

export function hasAccess(
  userTier: SubscriptionTier,
  required: SubscriptionTier,
): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[required];
}

export async function getSubscription(): Promise<{
  tier: SubscriptionTier;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { tier: "free", error: "Not authenticated" };

  const { data, error } = await (supabase as any)
    .from("profiles")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();

  if (error) return { tier: "free", error: error.message };
  return { tier: (data?.subscription_tier as SubscriptionTier) ?? "free" };
}

export async function selectPlan(tier: SubscriptionTier) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!["free", "starter", "pro", "founder"].includes(tier)) {
    return { error: "Invalid plan" };
  }

  // TODO: Replace with Stripe Checkout flow — this is a temporary direct update
  const { error } = await (supabase as any)
    .from("profiles")
    .update({
      subscription_tier: tier,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  revalidatePath("/pricing");
  return { success: true };
}
