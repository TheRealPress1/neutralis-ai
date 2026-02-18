"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getStripe, PRICE_MAP } from "@/lib/stripe";
import { rateLimit, SENSITIVE_LIMIT, GENERAL_LIMIT, getClientIp } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

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

export async function selectPlan(
  tier: SubscriptionTier,
): Promise<{ success?: boolean; checkoutUrl?: string; error?: string }> {
  const ip = await getClientIp();
  if (!rateLimit(`sub:plan:${ip}`, GENERAL_LIMIT).success) {
    return { error: "Too many attempts. Please try again later." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!["free", "starter", "pro"].includes(tier)) {
    return { error: "Invalid plan" };
  }

  // Downgrade to free — cancel Stripe subscription if one exists
  if (tier === "free") {
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("stripe_subscription_id")
      .eq("id", user.id)
      .single();

    if (profile?.stripe_subscription_id) {
      try {
        await getStripe().subscriptions.cancel(profile.stripe_subscription_id);
      } catch (err: any) {
        console.error("Failed to cancel Stripe subscription:", err.message);
        // Still update DB — subscription may already be canceled
      }
    }

    const { error } = await (supabase as any)
      .from("profiles")
      .update({
        subscription_tier: "free",
        stripe_subscription_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) return { error: error.message };

    revalidatePath("/profile");
    revalidatePath("/dashboard");
    revalidatePath("/pricing");
    return { success: true };
  }

  // Upgrade to starter/pro — create Stripe Checkout session
  const priceId = PRICE_MAP[tier];
  if (!priceId) {
    // Stripe not configured yet — fall back to direct update
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

  // Look up or create Stripe customer
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("stripe_customer_id, full_name")
    .eq("id", user.id)
    .single();

  let customerId = profile?.stripe_customer_id;

  if (!customerId) {
    const customer = await getStripe().customers.create({
      email: user.email,
      name: profile?.full_name || undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;

    await (supabase as any)
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  // If user already has an active subscription, update it instead of creating a new one
  if (profile?.stripe_subscription_id) {
    try {
      const sub = await getStripe().subscriptions.retrieve(
        profile.stripe_subscription_id,
      );
      if (sub.status === "active" || sub.status === "trialing") {
        await getStripe().subscriptions.update(profile.stripe_subscription_id, {
          items: [{ id: sub.items.data[0].id, price: priceId }],
          metadata: { supabase_user_id: user.id, tier },
        });

        // Update tier immediately for plan switches
        await (supabase as any)
          .from("profiles")
          .update({
            subscription_tier: tier,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);

        revalidatePath("/profile");
        revalidatePath("/dashboard");
        revalidatePath("/pricing");
        return { success: true };
      }
    } catch {
      // Subscription doesn't exist or was canceled — proceed to checkout
    }
  }

  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL ? "https://neutralis.ai" : "http://localhost:3000"}/pricing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL ? "https://neutralis.ai" : "http://localhost:3000"}/pricing`,
    metadata: { supabase_user_id: user.id, tier },
    subscription_data: {
      metadata: { supabase_user_id: user.id, tier },
    },
  });

  return { checkoutUrl: session.url ?? undefined };
}

// ── Billing portal ──────────────────────────────────────────────────

export async function createBillingPortal(): Promise<{
  url?: string;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return { error: "No billing account found. Subscribe to a plan first." };
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL ? "https://neutralis.ai" : "http://localhost:3000"}/pricing`,
  });

  return { url: session.url };
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
  const ip = await getClientIp();
  if (!rateLimit(`sub:codegen:${ip}`, SENSITIVE_LIMIT).success) {
    return { error: "Too many attempts. Please try again later." };
  }

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
  logAudit("subscription.code_generated", { entityType: "access_code", entityId: code });
  return { code };
}

// ── Access code redemption ─────────────────────────────────────────

export async function redeemAccessCode(code: string): Promise<{
  success?: boolean;
  error?: string;
}> {
  const ip = await getClientIp();
  if (!rateLimit(`sub:redeem:${ip}`, SENSITIVE_LIMIT).success) {
    return { error: "Too many attempts. Please try again later." };
  }

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

  // Upgrade user to Pro (direct — bypasses Stripe)
  const { error: upgradeErr } = await (supabase as any)
    .from("profiles")
    .update({
      subscription_tier: "pro",
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (upgradeErr) return { error: "Failed to upgrade account" };

  logAudit("subscription.code_redeemed", {
    entityType: "access_code",
    details: { code: trimmed },
  });
  revalidatePath("/dashboard");
  revalidatePath("/pricing");
  return { success: true };
}
