import Stripe from "stripe";

let _stripe: Stripe | null = null;

/** Lazy-initialized Stripe instance — only fails when actually used, not at import time */
export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-01-28.clover",
    });
  }
  return _stripe;
}

/** Maps subscription tier → Stripe Price ID */
export const PRICE_MAP: Record<string, string | undefined> = {
  starter: process.env.STRIPE_STARTER_PRICE_ID || undefined,
  pro: process.env.STRIPE_PRO_PRICE_ID || undefined,
};

/** Reverse lookup: Stripe Price ID → tier name */
export function tierFromPriceId(priceId: string): "starter" | "pro" | null {
  for (const [tier, id] of Object.entries(PRICE_MAP)) {
    if (id && id === priceId) return tier as "starter" | "pro";
  }
  return null;
}
