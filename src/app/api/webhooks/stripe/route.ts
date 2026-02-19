import { NextResponse } from "next/server";
import { getStripe, tierFromPriceId } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import {
  sendSubscriptionConfirmedEmail,
  sendSubscriptionChangedEmail,
  sendSubscriptionCancelledEmail,
  sendPaymentFailedEmail,
} from "@/lib/email";
import type Stripe from "stripe";

/** Performance fee rates by subscription tier. */
const PERFORMANCE_FEE_RATES: Record<string, number> = {
  free: 0.0,
  starter: 0.12,
  pro: 0.07,
  founder: 0.0,
};

/** Minimum fee amount (in dollars) to attach to an invoice. */
const MIN_INVOICE_FEE = 0.50;

/** Fetch user email and first name from profiles. */
async function getUserProfile(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
): Promise<{ email: string; firstName: string } | null> {
  const { data } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", userId)
    .single();
  if (!data?.email) return null;
  const firstName = (data.full_name as string)?.split(" ")[0] || "there";
  return { email: data.email as string, firstName };
}

/**
 * Attach pending performance fees to a draft invoice.
 *
 * Called on `invoice.created` — Stripe fires this before finalizing each
 * billing cycle invoice.  We look up the user's unsettled performance fees
 * and add them as an invoice item.
 */
async function attachPerformanceFees(
  invoice: Stripe.Invoice,
  supabase: ReturnType<typeof createServiceClient>,
): Promise<void> {
  const customerId = invoice.customer as string;
  if (!customerId) return;

  // Only attach to subscription invoices (not one-off / manual)
  const reason = invoice.billing_reason;
  if (!reason || !reason.startsWith("subscription")) return;

  // Look up user by stripe_customer_id
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("id, subscription_tier")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!profile?.id) return;

  const tier: string = profile.subscription_tier ?? "free";
  const feeRate = PERFORMANCE_FEE_RATES[tier] ?? 0;
  if (feeRate <= 0) return;

  // Read fee state: accrued vs settled
  const { data: feeState } = await (supabase as any)
    .from("user_fee_state")
    .select("total_fees_accrued, total_fees_settled")
    .eq("user_id", profile.id)
    .single();

  if (!feeState) return;

  const accrued = Number(feeState.total_fees_accrued) || 0;
  const settled = Number(feeState.total_fees_settled) || 0;
  const pending = Math.round((accrued - settled) * 100) / 100; // round to cents

  if (pending < MIN_INVOICE_FEE) return;

  // Add performance fee as an invoice item (in cents for Stripe)
  const amountCents = Math.round(pending * 100);
  await getStripe().invoiceItems.create({
    customer: customerId,
    invoice: invoice.id,
    amount: amountCents,
    currency: "usd",
    description: `Performance fee (${Math.round(feeRate * 100)}% on net profits)`,
    metadata: {
      type: "performance_fee",
      supabase_user_id: profile.id,
      fee_rate: String(feeRate),
      amount_dollars: String(pending),
    },
  });

  // Mark fees as settled in the database
  await (supabase as any)
    .from("user_fee_state")
    .update({
      total_fees_settled: accrued,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", profile.id);

  console.log(
    `Performance fee: $${pending.toFixed(2)} attached to invoice ${invoice.id} for user ${profile.id} (${tier} @ ${feeRate * 100}%)`,
  );
}

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServiceClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        const tier = session.metadata?.tier;

        if (userId && tier) {
          await (supabase as any)
            .from("profiles")
            .update({
              subscription_tier: tier,
              stripe_subscription_id: session.subscription as string,
              updated_at: new Date().toISOString(),
            })
            .eq("id", userId);

          const profile = await getUserProfile(supabase, userId);
          if (profile) {
            sendSubscriptionConfirmedEmail(profile.email, profile.firstName, tier);
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;

        if (userId) {
          const priceId = subscription.items.data[0]?.price?.id;
          const tier = priceId ? tierFromPriceId(priceId) : null;

          if (tier) {
            await (supabase as any)
              .from("profiles")
              .update({
                subscription_tier: tier,
                updated_at: new Date().toISOString(),
              })
              .eq("id", userId);

            const profile = await getUserProfile(supabase, userId);
            if (profile) {
              sendSubscriptionChangedEmail(profile.email, profile.firstName, tier);
            }
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;

        if (userId) {
          await (supabase as any)
            .from("profiles")
            .update({
              subscription_tier: "free",
              stripe_subscription_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", userId);

          const profile = await getUserProfile(supabase, userId);
          if (profile) {
            sendSubscriptionCancelledEmail(profile.email, profile.firstName);
          }
        }
        break;
      }

      case "invoice.created": {
        // Attach pending performance fees to the draft invoice before it finalizes
        const draftInvoice = event.data.object as Stripe.Invoice;
        if (draftInvoice.status === "draft") {
          await attachPerformanceFees(draftInvoice, supabase);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        if (customerId) {
          const { data: profileRow } = await (supabase as any)
            .from("profiles")
            .select("email, full_name")
            .eq("stripe_customer_id", customerId)
            .single();

          if (profileRow?.email) {
            const firstName = profileRow.full_name?.split(" ")[0] || "there";
            sendPaymentFailedEmail(profileRow.email, firstName);
          }
        }
        break;
      }
    }
  } catch (err: any) {
    console.error("Webhook processing error:", err);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
