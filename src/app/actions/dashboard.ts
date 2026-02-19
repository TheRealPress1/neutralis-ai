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

export async function getActiveRiskProfile(): Promise<{
  data?: RiskProfile;
  error?: string;
}> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("risk_profiles")
    .select("*")
    .eq("is_active", true)
    .limit(1)
    .single();

  if (error) return { error: error.message };
  return { data: data as RiskProfile };
}

export async function updateRiskProfile(
  profileId: number,
  updates: Partial<Omit<RiskProfile, "id" | "is_active" | "user_id" | "created_at" | "updated_at">>,
): Promise<{ data?: RiskProfile; error?: string }> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("risk_profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", profileId)
    .select()
    .single();

  if (error) return { error: error.message };
  return { data: data as RiskProfile };
}
