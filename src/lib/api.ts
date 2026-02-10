/* Typed fetch client for the FastAPI dashboard endpoints. */

import type {
  CategoryMeta,
  PortfolioStats,
  Position,
  Signal,
  Decision,
  MarketMatch,
  RiskProfile,
} from "@/types/api";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch<T>(
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(path, API_BASE);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function fetchPortfolioStats() {
  return apiFetch<PortfolioStats>("/api/portfolio/stats");
}

export function fetchPositions(status: "open" | "closed", limit = 50) {
  return apiFetch<Position[]>("/api/positions", {
    status,
    limit: String(limit),
  });
}

export function fetchSignals(limit = 20) {
  return apiFetch<Signal[]>("/api/signals", { limit: String(limit) });
}

export function fetchDecisions(limit = 20) {
  return apiFetch<Decision[]>("/api/decisions", { limit: String(limit) });
}

export function fetchMatches(limit = 25) {
  return apiFetch<MarketMatch[]>("/api/matches", { limit: String(limit) });
}

// --- Risk Profiles ---

export function fetchCategories() {
  return apiFetch<CategoryMeta[]>("/api/categories");
}

export function fetchProfiles() {
  return apiFetch<RiskProfile[]>("/api/profiles");
}

export function fetchActiveProfile() {
  return apiFetch<RiskProfile>("/api/profiles/active");
}

export async function updateProfile(
  profileId: number,
  updates: Partial<
    Omit<RiskProfile, "id" | "is_active" | "user_id" | "created_at" | "updated_at">
  >,
): Promise<RiskProfile> {
  const url = new URL(`/api/profiles/${profileId}`, API_BASE);
  const res = await fetch(url.toString(), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json() as Promise<RiskProfile>;
}

export async function activateProfile(
  profileId: number,
): Promise<RiskProfile> {
  const url = new URL(`/api/profiles/${profileId}/activate`, API_BASE);
  const res = await fetch(url.toString(), { method: "PUT" });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json() as Promise<RiskProfile>;
}
