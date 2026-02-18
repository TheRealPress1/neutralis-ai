export type SubscriptionTier = "free" | "starter" | "pro";

export const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  starter: 1,
  pro: 2,
};

export function hasAccess(
  userTier: SubscriptionTier,
  required: SubscriptionTier,
): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[required];
}
