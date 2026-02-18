"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

import type { SubscriptionTier } from "@/lib/subscription";
export type { SubscriptionTier };

export async function getSubscription(): Promise<{
  tier: SubscriptionTier;
  isFounder: boolean;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { tier: "free", isFounder: false, error: "Not authenticated" };

  const { data, error } = await (supabase as any)
    .from("profiles")
    .select("subscription_tier, is_founder")
    .eq("id", user.id)
    .single();

  if (error) return { tier: "free", isFounder: false, error: error.message };

  const isFounder = data?.is_founder === true;
  // Founders always see Pro-level access
  const tier: SubscriptionTier = isFounder
    ? "pro"
    : ((data?.subscription_tier as SubscriptionTier) ?? "free");

  return { tier, isFounder };
}

export async function selectPlan(tier: SubscriptionTier) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!["free", "starter", "pro"].includes(tier)) {
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

// ── Access code generation (founder-only) ──────────────────────────

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function generateAccessCode(): Promise<{
  code?: string;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify caller is a founder
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("is_founder")
    .eq("id", user.id)
    .single();

  if (!profile?.is_founder) return { error: "Unauthorized" };

  const code = generateCode();
  const { error } = await (supabase as any)
    .from("access_codes")
    .insert({ code, created_by: user.id });

  if (error) return { error: error.message };
  return { code };
}

// ── Access code redemption ─────────────────────────────────────────

export async function redeemAccessCode(code: string): Promise<{
  success?: boolean;
  error?: string;
}> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return { error: "Please enter a code" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Check if user is already Pro
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();

  if (profile?.subscription_tier === "pro") {
    return { error: "You already have Pro access" };
  }

  // Find the code
  const { data: codeRow, error: fetchErr } = await (supabase as any)
    .from("access_codes")
    .select("id, redeemed_by")
    .eq("code", trimmed)
    .single();

  if (fetchErr || !codeRow) return { error: "Invalid access code" };
  if (codeRow.redeemed_by) return { error: "This code has already been used" };

  // Mark code as redeemed
  const { error: updateCodeErr } = await (supabase as any)
    .from("access_codes")
    .update({ redeemed_by: user.id, redeemed_at: new Date().toISOString() })
    .eq("id", codeRow.id);

  if (updateCodeErr) return { error: "Failed to redeem code" };

  // Upgrade user to Pro
  const { error: upgradeErr } = await (supabase as any)
    .from("profiles")
    .update({
      subscription_tier: "pro",
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (upgradeErr) return { error: "Failed to upgrade account" };

  revalidatePath("/dashboard");
  revalidatePath("/pricing");
  return { success: true };
}
