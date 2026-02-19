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
