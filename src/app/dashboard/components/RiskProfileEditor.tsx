"use client";

import { useEffect, useState, useCallback } from "react";
import type { RiskProfile, CategoryMeta, CategoryOverride } from "@/types/api";
import {
  fetchCategories,
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
  { accent: string; border: string; label: string; description: string }
> = {
  conservative: {
    accent: "text-blue-400",
    border: "border-blue-400/40",
    label: "Conservative",
    description: "Lower risk, tighter limits. Prioritizes capital preservation over returns.",
  },
  moderate: {
    accent: "text-amber-400",
    border: "border-amber-400/40",
    label: "Moderate",
    description: "Balanced risk/reward. Good default for most market conditions.",
  },
  aggressive: {
    accent: "text-red-400",
    border: "border-red-400/40",
    label: "Aggressive",
    description: "Higher exposure, wider signal acceptance. Maximizes opportunity at higher risk.",
  },
  custom: {
    accent: "text-[#c0c5cb]",
    border: "border-[#c0c5cb]/40",
    label: "Custom",
    description: "Manually tuned parameters.",
  },
};

const RISK_LEVEL_STYLES: Record<string, { bg: string; text: string }> = {
  conservative: { bg: "bg-blue-400/15", text: "text-blue-400" },
  moderate: { bg: "bg-amber-400/15", text: "text-amber-400" },
  aggressive: { bg: "bg-red-400/15", text: "text-red-400" },
};

const DEFAULT_OVERRIDE: CategoryOverride = {
  enabled: true,
  risk_level: "moderate",
  max_exposure_dollars: null,
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
  const [categories, setCategories] = useState<CategoryMeta[]>([]);
  const [active, setActive] = useState<RiskProfile | null>(null);
  const [form, setForm] = useState<Record<string, number>>({});
  const [catForm, setCatForm] = useState<Record<string, CategoryOverride>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "Category Overrides": false,
    "Portfolio Limits": false,
    "Signal Quality": false,
    "Position Sizing": false,
  });

  const loadData = useCallback(async () => {
    try {
      const [profileData, catData] = await Promise.all([
        fetchProfiles(),
        fetchCategories(),
      ]);
      setProfiles(profileData);
      setCategories(catData);
      const current = profileData.find((p) => p.is_active);
      if (current) {
        setActive(current);
        populateForm(current);
        populateCatForm(current, catData);
      }
    } catch {
      /* tables may not exist yet */
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  function populateCatForm(
    profile: RiskProfile,
    cats: CategoryMeta[],
  ) {
    const overrides: Record<string, CategoryOverride> = {};
    for (const cat of cats) {
      overrides[cat.slug] =
        profile.category_overrides?.[cat.slug] ?? { ...DEFAULT_OVERRIDE };
    }
    setCatForm(overrides);
  }

  function hasChanges(): boolean {
    if (!active) return false;
    for (const group of PARAM_GROUPS) {
      for (const p of group.params) {
        const saved = toDisplay(active[p.key] as number, p);
        if (Math.abs((form[p.key] ?? 0) - saved) > 0.001) return true;
      }
    }
    const savedOverrides = active.category_overrides ?? {};
    for (const [slug, override] of Object.entries(catForm)) {
      const saved = savedOverrides[slug] ?? DEFAULT_OVERRIDE;
      if (override.enabled !== saved.enabled) return true;
      if (override.risk_level !== saved.risk_level) return true;
      if (override.max_exposure_dollars !== saved.max_exposure_dollars)
        return true;
    }
    return false;
  }

  async function handleActivate(profileId: number) {
    try {
      const updated = await activateProfile(profileId);
      setActive(updated);
      populateForm(updated);
      populateCatForm(updated, categories);
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

    const updates: Record<string, unknown> = {};
    for (const group of PARAM_GROUPS) {
      for (const p of group.params) {
        const displayVal = form[p.key] ?? 0;
        updates[p.key] = fromDisplay(displayVal, p);
      }
    }
    updates.category_overrides = catForm;

    try {
      const updated = await updateProfile(active.id, updates);
      setActive(updated);
      populateForm(updated);
      populateCatForm(updated, categories);
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
    if (active) {
      populateForm(active);
      populateCatForm(active, categories);
    }
  }

  function toggleGroup(title: string) {
    setOpenGroups((prev) => ({ ...prev, [title]: !prev[title] }));
  }

  function updateCatOverride(
    slug: string,
    patch: Partial<CategoryOverride>,
  ) {
    setCatForm((prev) => ({
      ...prev,
      [slug]: { ...(prev[slug] ?? DEFAULT_OVERRIDE), ...patch },
    }));
  }

  if (profiles.length === 0) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="card-panel rounded-xl p-8 text-center text-[#a1a8b3]">
          Loading risk profiles...
        </div>
      </div>
    );
  }

  const basePresets = profiles.filter(
    (p) => !p.strategy && p.preset !== "custom",
  );

  return (
    <div className="mx-auto max-w-5xl">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
      <p className="mt-1 text-sm text-[#a1a8b3]">
        Choose a risk profile to set your target return and exposure limits.
        The bot allocates freely across categories to meet your target.
        Changes take effect on the next pipeline cycle.
      </p>

      {/* ── Risk Profile Selection ──────────────────────────────────── */}
      <h3 className="mt-8 text-xs font-semibold uppercase tracking-wider text-[#a1a8b3]">
        Risk Profile
      </h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        {basePresets.map((profile) => {
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
                  : "border border-transparent opacity-50 hover:opacity-90"
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
              <p className="mt-1.5 text-xs leading-relaxed text-[#a1a8b3]">
                {style.description}
              </p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-2xl font-bold">
                  {profile.target_annual_return_pct}%
                </span>
                <span className="text-xs text-[#a1a8b3]">
                  target return
                </span>
              </div>
              <div className="mt-2 flex gap-4 text-[11px] text-[#a1a8b3]">
                <span>${profile.max_total_exposure_dollars} max exposure</span>
                <span>{profile.min_edge_pct}% min edge</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Custom profile badge ──────────────────────────────────── */}
      {active && active.preset === "custom" && (
        <div className="mt-4 rounded-lg border border-[#c0c5cb]/20 bg-[#c0c5cb]/5 px-4 py-2 text-xs text-[#c0c5cb]">
          Custom profile active — parameters have been manually adjusted
        </div>
      )}

      {/* ── Advanced: Category Overrides + Parameters ──────────────── */}
      <div className="mt-10 space-y-4">
        <div className="flex items-baseline justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#eceef0]">
              Advanced
            </h3>
            <p className="mt-0.5 text-xs text-[#a1a8b3]">
              Optional overrides. The bot handles allocation automatically
              — only adjust these if you want to exclude categories or
              fine-tune specific parameters.
            </p>
          </div>
        </div>

        {/* Category Overrides */}
        <div className="card-panel rounded-xl">
          <button
            onClick={() => toggleGroup("Category Overrides")}
            className="flex w-full items-center justify-between px-6 py-4 text-left"
          >
            <div>
              <h3 className="text-sm font-semibold">Category Overrides</h3>
              <p className="mt-0.5 text-xs text-[#a1a8b3]">
                Optionally block categories or cap exposure per market type
              </p>
            </div>
            <span className="text-xs text-[#a1a8b3]">
              {openGroups["Category Overrides"] ? "\u25B2" : "\u25BC"}
            </span>
          </button>

          {openGroups["Category Overrides"] && (
            <div className="border-t border-[#22262d] px-6 pb-6 pt-4">
              <div className="space-y-3">
                {categories.map((cat) => {
                  const override = catForm[cat.slug] ?? DEFAULT_OVERRIDE;
                  const isEnabled = override.enabled;
                  return (
                    <div
                      key={cat.slug}
                      className={`flex items-center gap-4 rounded-lg border border-[#22262d] p-3 transition-opacity ${
                        isEnabled ? "" : "opacity-40"
                      }`}
                    >
                      {/* Color dot + label */}
                      <div className="flex min-w-[120px] items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="text-sm font-medium">
                          {cat.label}
                        </span>
                      </div>

                      {/* Toggle */}
                      <button
                        onClick={() =>
                          updateCatOverride(cat.slug, {
                            enabled: !isEnabled,
                          })
                        }
                        className={`relative h-5 w-9 rounded-full transition-colors ${
                          isEnabled ? "bg-emerald-400" : "bg-[#22262d]"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                            isEnabled ? "left-[18px]" : "left-0.5"
                          }`}
                        />
                      </button>

                      {/* Risk level buttons */}
                      <div className="flex gap-1">
                        {(
                          ["conservative", "moderate", "aggressive"] as const
                        ).map((level) => {
                          const isSelected =
                            override.risk_level === level;
                          const rlStyle = RISK_LEVEL_STYLES[level];
                          return (
                            <button
                              key={level}
                              onClick={() =>
                                updateCatOverride(cat.slug, {
                                  risk_level: level,
                                })
                              }
                              disabled={!isEnabled}
                              className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                                isSelected
                                  ? `${rlStyle.bg} ${rlStyle.text}`
                                  : "text-[#a1a8b3] hover:text-[#eceef0]"
                              } disabled:cursor-not-allowed`}
                            >
                              {level.charAt(0).toUpperCase() +
                                level.slice(1, 4)}
                            </button>
                          );
                        })}
                      </div>

                      {/* Max exposure input */}
                      <div className="ml-auto flex items-center gap-1.5">
                        <span className="text-[10px] text-[#a1a8b3]">
                          Max $
                        </span>
                        <input
                          type="number"
                          placeholder="No limit"
                          value={
                            override.max_exposure_dollars ?? ""
                          }
                          disabled={!isEnabled}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateCatOverride(cat.slug, {
                              max_exposure_dollars:
                                val === ""
                                  ? null
                                  : parseFloat(val) || 0,
                            });
                          }}
                          className="w-20 rounded border border-[#22262d] bg-[#08090c] px-2 py-1 text-xs text-[#eceef0] outline-none transition-colors focus:border-[#c0c5cb] disabled:cursor-not-allowed disabled:opacity-40"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Parameter Groups ──────────────────────────────────────── */}
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
                  <p className="mt-0.5 text-xs text-[#a1a8b3]">
                    {group.description}
                  </p>
                </div>
                <span className="text-xs text-[#a1a8b3]">
                  {isOpen ? "\u25B2" : "\u25BC"}
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-[#22262d] px-6 pb-6 pt-4">
                  <div className="grid gap-5 sm:grid-cols-2">
                    {group.params.map((param) => {
                      const val = form[param.key] ?? 0;
                      return (
                        <div key={param.key}>
                          <label className="flex items-baseline gap-2 text-sm font-medium">
                            {param.label}
                            {param.unit && (
                              <span className="text-xs text-[#a1a8b3]">
                                ({param.unit})
                              </span>
                            )}
                          </label>
                          <p className="mt-0.5 text-[11px] leading-tight text-[#a1a8b3]">
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
                                [param.key]:
                                  parseFloat(e.target.value) || 0,
                              }))
                            }
                            className="mt-2 w-full rounded-lg border border-[#22262d] bg-[#08090c] px-3 py-2 text-sm text-[#eceef0] outline-none transition-colors focus:border-[#c0c5cb]"
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

      {/* ── Actions ───────────────────────────────────────────────── */}
      <div className="mt-6 flex items-center gap-4 pb-8">
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges()}
          className={`rounded-lg px-5 py-2.5 text-sm font-medium transition-colors ${
            hasChanges() && !saving
              ? "bg-[#eceef0] text-[#08090c] hover:bg-[#c0c5cb]"
              : "cursor-not-allowed bg-[#22262d] text-[#a1a8b3]"
          }`}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        <button
          onClick={handleReset}
          disabled={!hasChanges()}
          className="rounded-lg border border-[#22262d] px-5 py-2.5 text-sm font-medium text-[#a1a8b3] transition-colors hover:border-[#c0c5cb] hover:text-[#eceef0] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reset
        </button>
        {message && (
          <span className="text-sm text-emerald-400">{message}</span>
        )}
      </div>
    </div>
  );
}
