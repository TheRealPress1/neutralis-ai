"use server";

import { createClient } from "@/lib/supabase/server";

export interface RiskProfileRow {
  id: number;
  name: string;
  preset: string;
  is_active: boolean;
  target_annual_return_pct: number;
  description: string;
  min_edge_pct: number;
  min_liquidity_dollars: number;
  max_time_to_expiry_hours: number;
  min_time_to_expiry_hours: number;
  fee_rate: number;
  max_position_dollars: number;
  max_total_exposure_dollars: number;
  max_event_exposure_dollars: number;
  max_ticker_exposure_dollars: number;
  max_venue_exposure_pct: number;
  max_open_positions: number;
  min_similarity: number;
  category_overrides: Record<string, unknown> | null;
  strategy: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function getRiskProfiles(): Promise<{
  profiles: RiskProfileRow[];
  error: string | null;
}> {
  const supabase = await createClient();

  // Fetch global profiles (user_id IS NULL) — shared presets
  const { data, error } = await (supabase as any)
    .from("risk_profiles")
    .select("*")
    .is("user_id", null)
    .order("id", { ascending: true });

  if (error) return { profiles: [], error: error.message };
  return { profiles: (data as RiskProfileRow[]) ?? [], error: null };
}

export async function activateRiskProfile(
  profileId: number,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Deactivate all global profiles first
  const { error: deactivateErr } = await (supabase as any)
    .from("risk_profiles")
    .update({ is_active: false })
    .is("user_id", null);

  if (deactivateErr) return { error: deactivateErr.message };

  // Activate the selected one
  const { error: activateErr } = await (supabase as any)
    .from("risk_profiles")
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("id", profileId);

  if (activateErr) return { error: activateErr.message };
  return { error: null };
}

export async function updateRiskProfile(
  profileId: number,
  updates: Record<string, unknown>,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await (supabase as any)
    .from("risk_profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", profileId);

  if (error) return { error: error.message };
  return { error: null };
}
