"use client";

import { useEffect, useState, useCallback } from "react";
import type { RiskProfile } from "@/types/api";
import {
  fetchProfiles,
  activateProfile,
  updateProfile,
} from "@/lib/api";

/* ── Parameter metadata ─────────────────────────────────────────── */

interface ParamDef {
  key: keyof RiskProfile;
  label: string;
  unit: string;
  step: number;
  min: number;
  max: number;
  description: string;
  displayMultiplier?: number;
}

interface ParamGroup {
  title: string;
  description: string;
  params: ParamDef[];
}

const PARAM_GROUPS: ParamGroup[] = [
  {
    title: "Portfolio Limits",
    description: "Controls how much capital the system can deploy",
    params: [
      {
        key: "max_total_exposure_dollars",
        label: "Max Total Exposure",
        unit: "$",
        step: 50,
        min: 50,
        max: 10000,
        description: "Maximum total dollars across all open positions",
      },
      {
        key: "max_event_exposure_dollars",
        label: "Max Event Exposure",
        unit: "$",
        step: 10,
        min: 10,
        max: 5000,
        description: "Maximum dollars exposed to any single event",
      },
      {
        key: "max_ticker_exposure_dollars",
        label: "Max Ticker Exposure",
        unit: "$",
        step: 5,
        min: 5,
        max: 2000,
        description: "Maximum dollars on any single market ticker",
      },
      {
        key: "max_venue_exposure_pct",
        label: "Max Venue Concentration",
        unit: "%",
        step: 5,
        min: 10,
        max: 100,
        description: "Max percentage of portfolio on a single venue",
        displayMultiplier: 100,
      },
      {
        key: "max_open_positions",
        label: "Max Open Positions",
        unit: "",
        step: 1,
        min: 5,
        max: 500,
        description: "Maximum simultaneously open positions",
      },
    ],
  },
  {
    title: "Signal Quality",
    description: "Controls which opportunities the system considers",
    params: [
      {
        key: "min_edge_pct",
        label: "Min Edge",
        unit: "%",
        step: 0.1,
        min: 0.1,
        max: 20,
        description: "Minimum percentage edge to generate a signal",
      },
      {
        key: "min_liquidity_dollars",
        label: "Min Liquidity",
        unit: "$",
        step: 5,
        min: 5,
        max: 1000,
        description: "Minimum market liquidity to consider a trade",
      },
      {
        key: "min_time_to_expiry_hours",
        label: "Min Time to Expiry",
        unit: "hrs",
        step: 0.5,
        min: 0,
        max: 168,
        description: "Minimum hours until market expiration",
      },
      {
        key: "max_time_to_expiry_hours",
        label: "Max Time to Expiry",
        unit: "hrs",
        step: 24,
        min: 24,
        max: 8760,
        description: "Maximum hours until market expiration",
      },
      {
        key: "fee_rate",
        label: "Fee Rate",
        unit: "%",
        step: 0.5,
        min: 0,
        max: 50,
        description: "Expected fee rate per contract",
        displayMultiplier: 100,
      },
      {
        key: "min_similarity",
        label: "Cross-Platform Min Similarity",
        unit: "%",
        step: 5,
        min: 10,
        max: 100,
        description: "Minimum score for matching across venues",
        displayMultiplier: 100,
      },
    ],
  },
  {
    title: "Position Sizing",
    description: "Controls how large individual positions can be",
    params: [
      {
        key: "max_position_dollars",
        label: "Max Position Size",
        unit: "$",
        step: 5,
        min: 1,
        max: 500,
        description: "Maximum dollars allocated to a single position",
      },
      {
        key: "target_annual_return_pct",
        label: "Target Annual Return",
        unit: "%",
        step: 1,
        min: 1,
        max: 100,
        description: "Your expected annual return target",
      },
    ],
  },
];

const PRESET_STYLES: Record<
  string,
  { accent: string; border: string; label: string }
> = {
  conservative: {
    accent: "text-blue-400",
    border: "border-blue-400/40",
    label: "Conservative",
  },
  moderate: {
    accent: "text-amber-400",
    border: "border-amber-400/40",
    label: "Moderate",
  },
  aggressive: {
    accent: "text-red-400",
    border: "border-red-400/40",
    label: "Aggressive",
  },
  custom: {
    accent: "text-[#c0c5cb]",
    border: "border-[#c0c5cb]/40",
    label: "Custom",
  },
};

/* ── Helpers ─────────────────────────────────────────────────────── */

function toDisplay(value: number, def: ParamDef): number {
  return def.displayMultiplier ? value * def.displayMultiplier : value;
}

function fromDisplay(display: number, def: ParamDef): number {
  return def.displayMultiplier ? display / def.displayMultiplier : display;
}

/* ── Component ───────────────────────────────────────────────────── */

export default function RiskProfileEditor() {
  const [profiles, setProfiles] = useState<RiskProfile[]>([]);
  const [active, setActive] = useState<RiskProfile | null>(null);
  const [form, setForm] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "Portfolio Limits": true,
    "Signal Quality": false,
    "Position Sizing": false,
  });

  const loadProfiles = useCallback(async () => {
    try {
      const data = await fetchProfiles();
      setProfiles(data);
      const current = data.find((p) => p.is_active);
      if (current) {
        setActive(current);
        populateForm(current);
      }
    } catch {
      /* profiles table may not exist yet */
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  function populateForm(profile: RiskProfile) {
    const values: Record<string, number> = {};
    for (const group of PARAM_GROUPS) {
      for (const p of group.params) {
        const raw = profile[p.key] as number;
        values[p.key] = toDisplay(raw, p);
      }
    }
    setForm(values);
  }

  function hasChanges(): boolean {
    if (!active) return false;
    for (const group of PARAM_GROUPS) {
      for (const p of group.params) {
        const saved = toDisplay(active[p.key] as number, p);
        if (Math.abs((form[p.key] ?? 0) - saved) > 0.001) return true;
      }
    }
    return false;
  }

  async function handleActivate(profileId: number) {
    try {
      const updated = await activateProfile(profileId);
      setActive(updated);
      populateForm(updated);
      const all = await fetchProfiles();
      setProfiles(all);
      setMessage(`Switched to ${updated.name}`);
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage("Failed to switch profile");
    }
  }

  async function handleSave() {
    if (!active) return;
    setSaving(true);
    setMessage(null);

    const updates: Record<string, number> = {};
    for (const group of PARAM_GROUPS) {
      for (const p of group.params) {
        const displayVal = form[p.key] ?? 0;
        updates[p.key] = fromDisplay(displayVal, p);
      }
    }

    try {
      const updated = await updateProfile(active.id, updates);
      setActive(updated);
      populateForm(updated);
      const all = await fetchProfiles();
      setProfiles(all);
      setMessage("Profile saved");
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage("Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (active) populateForm(active);
  }

  function toggleGroup(title: string) {
    setOpenGroups((prev) => ({ ...prev, [title]: !prev[title] }));
  }

  if (profiles.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-6">
        <div className="card-panel rounded-xl p-8 text-center text-[#9ca3af]">
          Loading risk profiles...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6">
      <h2 className="text-2xl font-bold tracking-tight">Risk Profile</h2>
      <p className="mt-2 text-sm text-[#9ca3af]">
        Tailor the pipeline to your risk tolerance and return expectations.
        Changes take effect on the next pipeline cycle.
      </p>

      {/* ── Preset Cards ──────────────────────────────────────── */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {profiles
          .filter((p) => p.preset !== "custom")
          .map((profile) => {
            const style =
              PRESET_STYLES[profile.preset] ?? PRESET_STYLES.custom;
            const isActive = profile.is_active;
            return (
              <button
                key={profile.id}
                onClick={() => handleActivate(profile.id)}
                className={`card-panel rounded-xl p-5 text-left transition-all ${
                  isActive
                    ? `border ${style.border} ring-1 ring-inset ring-white/5`
                    : "border border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-semibold ${style.accent}`}>
                    {style.label}
                  </span>
                  {isActive && (
                    <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                      Active
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-[#9ca3af]">
                  {profile.description}
                </p>
                <p className="mt-3 text-lg font-bold">
                  {profile.target_annual_return_pct}%{" "}
                  <span className="text-xs font-normal text-[#9ca3af]">
                    target return
                  </span>
                </p>
                <div className="mt-2 flex gap-3 text-[11px] text-[#9ca3af]">
                  <span>${profile.max_total_exposure_dollars} max</span>
                  <span>{profile.min_edge_pct}% min edge</span>
                </div>
              </button>
            );
          })}
      </div>

      {/* ── Active Profile Badge ──────────────────────────────── */}
      {active && active.preset === "custom" && (
        <div className="mt-4 rounded-lg border border-[#c0c5cb]/20 bg-[#c0c5cb]/5 px-4 py-2 text-xs text-[#c0c5cb]">
          Custom profile — parameters differ from any preset
        </div>
      )}

      {/* ── Parameter Groups ──────────────────────────────────── */}
      <div className="mt-8 space-y-4">
        {PARAM_GROUPS.map((group) => {
          const isOpen = openGroups[group.title] ?? false;
          return (
            <div key={group.title} className="card-panel rounded-xl">
              <button
                onClick={() => toggleGroup(group.title)}
                className="flex w-full items-center justify-between px-6 py-4 text-left"
              >
                <div>
                  <h3 className="text-sm font-semibold">{group.title}</h3>
                  <p className="mt-0.5 text-xs text-[#9ca3af]">
                    {group.description}
                  </p>
                </div>
                <span className="text-[#9ca3af] transition-transform">
                  {isOpen ? "\u25B2" : "\u25BC"}
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-[#1a1d21] px-6 pb-6 pt-4">
                  <div className="grid gap-5 sm:grid-cols-2">
                    {group.params.map((param) => {
                      const val = form[param.key] ?? 0;
                      return (
                        <div key={param.key}>
                          <label className="flex items-baseline gap-2 text-sm font-medium">
                            {param.label}
                            {param.unit && (
                              <span className="text-xs text-[#9ca3af]">
                                ({param.unit})
                              </span>
                            )}
                          </label>
                          <p className="mt-0.5 text-[11px] leading-tight text-[#9ca3af]">
                            {param.description}
                          </p>
                          <input
                            type="number"
                            value={val}
                            step={param.step}
                            min={param.min}
                            max={param.max}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                [param.key]: parseFloat(e.target.value) || 0,
                              }))
                            }
                            className="mt-2 w-full rounded-lg border border-[#1a1d21] bg-[#050608] px-3 py-2 text-sm text-[#e8e9ea] outline-none transition-colors focus:border-[#c0c5cb]"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Actions ───────────────────────────────────────────── */}
      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges()}
          className={`rounded-lg px-5 py-2.5 text-sm font-medium transition-colors ${
            hasChanges() && !saving
              ? "bg-[#e8e9ea] text-[#050608] hover:bg-[#c0c5cb]"
              : "cursor-not-allowed bg-[#1a1d21] text-[#9ca3af]"
          }`}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        <button
          onClick={handleReset}
          disabled={!hasChanges()}
          className="rounded-lg border border-[#1a1d21] px-5 py-2.5 text-sm font-medium text-[#9ca3af] transition-colors hover:border-[#c0c5cb] hover:text-[#e8e9ea] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reset
        </button>
        {message && (
          <span className="text-sm text-[#9ca3af]">{message}</span>
        )}
      </div>
    </div>
  );
}
