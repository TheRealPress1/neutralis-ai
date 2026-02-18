import { headers } from "next/headers";

/* ── In-memory sliding-window rate limiter ────────────────────────── */

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

// Cleanup stale entries every 60s to prevent memory leaks
const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, bucket] of store) {
    if (now > bucket.resetAt) store.delete(key);
  }
}

/**
 * Check if a request is within rate limits.
 * Returns `{ success: true }` if allowed, `{ success: false }` if blocked.
 */
export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): { success: boolean } {
  cleanup();

  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || now > bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { success: true };
  }

  bucket.count += 1;
  if (bucket.count > opts.limit) {
    return { success: false };
  }

  return { success: true };
}

/* ── Preset tiers ─────────────────────────────────────────────────── */

/** Auth actions: signup, signin, forgot/reset password — 5 per 60s */
export const AUTH_LIMIT = { limit: 5, windowMs: 60_000 };

/** Sensitive actions: key ops, password change — 10 per 60s */
export const SENSITIVE_LIMIT = { limit: 10, windowMs: 60_000 };

/** General actions: profile updates, plan changes — 30 per 60s */
export const GENERAL_LIMIT = { limit: 30, windowMs: 60_000 };

/* ── IP helper ────────────────────────────────────────────────────── */

/** Extract client IP from request headers (works behind Vercel/proxies). */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}
