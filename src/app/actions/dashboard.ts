"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { AutomationState, RiskProfile } from "@/types/api";

// ── Automation State ──────────────────────────────────────────────────

export async function setAutomationStatus(
  action: "start" | "pause" | "kill",
  reason?: string,
): Promise<{ data?: AutomationState; error?: string }> {
  // Authenticate
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return { error: "Unauthorized" };
  const userId = user.id;

  const supabase = createServiceClient();

  // Get current state for this user (or create initial row)
  let { data: current } = await supabase
    .from("automation_state")
    .select("*")
    .eq("user_id", userId)
    .limit(1)
    .single();

  if (!current) {
    const { data: created } = await supabase
      .from("automation_state")
      .insert({
        user_id: userId,
        status: "paused",
        kill_switch: false,
        daily_loss_dollars: 0,
        max_drawdown_dollars: 0,
        peak_portfolio_value: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (!created) return { error: "Failed to initialize automation state" };
    current = created;
  }

  const now = new Date().toISOString();
  let updates: Record<string, unknown>;

  switch (action) {
    case "start":
      updates = {
        status: "running",
        kill_switch: false,
        started_at: now,
        paused_at: null,
        killed_at: null,
        killed_reason: null,
        updated_at: now,
      };
      break;
    case "pause":
      updates = {
        status: "paused",
        paused_at: now,
        updated_at: now,
      };
      break;
    case "kill":
      updates = {
        status: "killed",
        kill_switch: true,
        killed_at: now,
        killed_reason: reason ?? "Manual kill switch",
        updated_at: now,
      };
      break;
  }

  const { data, error } = await supabase
    .from("automation_state")
    .update(updates)
    .eq("id", current.id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return { error: error.message };
  return { data: data as AutomationState };
}

// ── Risk Profiles ─────────────────────────────────────────────────────

// Server actions are callable without the settings UI. Only these numeric
// controls may be changed; ownership, activation, and metadata are server-owned.
const RISK_LIMITS: Record<string, readonly [number, number]> = {
  min_edge_pct: [0, 100],
  min_liquidity_dollars: [0, 1_000_000_000_000],
  min_time_to_expiry_hours: [0, 876_000],
  max_time_to_expiry_hours: [0, 876_000],
  max_position_dollars: [0.01, 1_000_000_000],
  max_total_exposure_dollars: [0.01, 1_000_000_000],
  max_event_exposure_dollars: [0.01, 1_000_000_000],
  max_ticker_exposure_dollars: [0.01, 1_000_000_000],
  max_venue_exposure_pct: [0, 1],
  max_open_positions: [1, 10_000],
  min_similarity: [0, 1],
};

export async function getActiveRiskProfile(): Promise<{
  data?: RiskProfile;
  error?: string;
}> {
  const authClient = await createClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return { error: "Unauthorized" };
  const supabase = createServiceClient();

  const ownProfile = () => supabase
    .from("risk_profiles")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  const { data, error } = await ownProfile();
  if (error) return { error: "Unable to load risk profile" };
  if (data) return { data: data as RiskProfile };

  // Existing users may only have the shared preset. Give them a personal copy
  // instead of returning a global row that the editor could try to modify.
  const { data: preset, error: presetError } = await supabase
    .from("risk_profiles")
    .select("*")
    .is("user_id", null)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (presetError || !preset) return { error: "No default risk profile is available" };

  const personal: Record<string, unknown> = {};
  for (const field of [
    ...Object.keys(RISK_LIMITS), "name", "preset", "description",
    "target_annual_return_pct", "fee_rate", "category_overrides", "strategy", "time_horizon",
  ]) {
    if (preset[field] !== undefined) personal[field] = preset[field];
  }
  const { data: created, error: createError } = await supabase
    .from("risk_profiles")
    .insert({ ...personal, user_id: user.id, is_active: true })
    .select("*")
    .single();
  if (createError?.code === "23505") {
    // Another tab may have initialized the same user's unique active profile.
    const { data: existing, error: existingError } = await ownProfile();
    if (!existingError && existing) return { data: existing as RiskProfile };
  }
  if (createError || !created) return { error: "Unable to initialize risk profile" };
  return { data: created as RiskProfile };
}

export async function updateRiskProfile(
  profileId: number,
  updates: Partial<Omit<RiskProfile, "id" | "is_active" | "user_id" | "created_at" | "updated_at">>,
): Promise<{ data?: RiskProfile; error?: string }> {
  const authClient = await createClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return { error: "Unauthorized" };
  if (!Number.isSafeInteger(profileId) || profileId <= 0) return { error: "Invalid risk profile" };
  if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
    return { error: "Invalid risk settings" };
  }
  const validated: Record<string, number> = {};
  for (const [field, value] of Object.entries(updates)) {
    if (!Object.hasOwn(RISK_LIMITS, field)) return { error: "Unsupported risk setting" };
    const [min, max] = RISK_LIMITS[field];
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max ||
      (field === "max_open_positions" && !Number.isInteger(value))) {
      return { error: `Invalid value for ${field}` };
    }
    validated[field] = value;
  }
  if (!Object.keys(validated).length) return { error: "No risk settings supplied" };
  const supabase = createServiceClient();

  const { data: current, error: readError } = await supabase
    .from("risk_profiles")
    .select("min_time_to_expiry_hours, max_time_to_expiry_hours")
    .eq("id", profileId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError || !current) return { error: "Risk profile not found" };
  const minHours = validated.min_time_to_expiry_hours ?? current.min_time_to_expiry_hours;
  const maxHours = validated.max_time_to_expiry_hours ?? current.max_time_to_expiry_hours;
  if (minHours > maxHours) return { error: "Minimum expiry must not exceed maximum expiry" };

  const { data, error } = await supabase
    .from("risk_profiles")
    .update({ ...validated, updated_at: new Date().toISOString() })
    .eq("id", profileId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error || !data) return { error: "Unable to update risk profile" };
  return { data: data as RiskProfile };
}
