import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for server-side use (API routes).
 * Bypasses RLS — use only in trusted server contexts.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
