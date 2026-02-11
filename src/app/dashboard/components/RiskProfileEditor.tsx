"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getRiskProfiles,
  activateRiskProfile,
  updateRiskProfile,
  type RiskProfileRow,
} from "@/app/actions/risk-profiles";

/* ── Fund metadata ──────────────────────────────────────────────── */

const FUND_META: Record<
  string,
  { accent: string; border: string; bg: string; icon: string; tagline: string }
> = {
  conservative: {
    accent: "text-blue-400",
    border: "border-blue-400/40",
    bg: "bg-blue-400/10",
    icon: "shield",
    tagline: "Capital preservation",
  },
  moderate: {
    accent: "text-amber-400",
    border: "border-amber-400/40",
    bg: "bg-amber-400/10",
    icon: "scale",
    tagline: "Balanced growth",
  },
  aggressive: {
    accent: "text-red-400",
    border: "border-red-400/40",
    bg: "bg-red-400/10",
    icon: "bolt",
    tagline: "Maximum opportunity",
  },
};

/* ── Parameter definitions for Advanced section ─────────────────── */

interface ParamDef {
  key: string;
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
    description: "Controls how much capital the fund can deploy",
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
    description: "Controls which opportunities the fund considers",
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

/* ── Helpers ──────────────────────────────────────────────────────── */

function toDisplay(value: number, def: ParamDef): number {
  return def.displayMultiplier ? value * def.displayMultiplier : value;
}

function fromDisplay(display: number, def: ParamDef): number {
  return def.displayMultiplier ? display / def.displayMultiplier : display;
}

function FundIcon({ type }: { type: string }) {
  if (type === "shield") {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
    );
  }
  if (type === "scale") {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0 0 12 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 0 1-2.031.352 5.988 5.988 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971Zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 0 1-2.031.352 5.989 5.989 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971Z" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
    </svg>
  );
}

/* ── Component ───────────────────────────────────────────────────── */

export default function RiskProfileEditor() {
  const [profiles, setProfiles] = useState<RiskProfileRow[]>([]);
  const [active, setActive] = useState<RiskProfileRow | null>(null);
  const [form, setForm] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "Portfolio Limits": false,
    "Signal Quality": false,
    "Position Sizing": false,
  });

  const loadData = useCallback(async () => {
    const result = await getRiskProfiles();
    if (result.error) {
      setLoadError(result.error);
      setLoading(false);
      return;
    }
    // Only show base fund presets (no strategy sub-profiles)
    const funds = result.profiles.filter(
      (p) => !p.strategy && p.preset !== "custom",
    );
    setProfiles(funds);
    const current = funds.find((p) => p.is_active) ?? funds[0] ?? null;
    if (current) {
      setActive(current);
      populateForm(current);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function populateForm(profile: RiskProfileRow) {
    const values: Record<string, number> = {};
    for (const group of PARAM_GROUPS) {
      for (const p of group.params) {
        const raw = (profile as unknown as Record<string, unknown>)[p.key] as number;
        values[p.key] = toDisplay(raw ?? 0, p);
      }
    }
    setForm(values);
  }

  function hasChanges(): boolean {
    if (!active) return false;
    for (const group of PARAM_GROUPS) {
      for (const p of group.params) {
        const raw = (active as unknown as Record<string, unknown>)[p.key] as number;
        const saved = toDisplay(raw ?? 0, p);
        if (Math.abs((form[p.key] ?? 0) - saved) > 0.001) return true;
      }
    }
    return false;
  }

  async function handleSelectFund(profile: RiskProfileRow) {
    const result = await activateRiskProfile(profile.id);
    if (result.error) {
      setMessage("Failed to switch fund");
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    // Re-fetch to get updated is_active flags
    const refreshed = await getRiskProfiles();
    if (!refreshed.error) {
      const funds = refreshed.profiles.filter(
        (p) => !p.strategy && p.preset !== "custom",
      );
      setProfiles(funds);
      const updated = funds.find((p) => p.id === profile.id) ?? profile;
      setActive(updated);
      populateForm(updated);
    }
    setMessage(`Switched to ${profile.name}`);
    setTimeout(() => setMessage(null), 3000);
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

    const result = await updateRiskProfile(active.id, updates);
    if (result.error) {
      setMessage("Failed to save changes");
    } else {
      // Re-fetch
      const refreshed = await getRiskProfiles();
      if (!refreshed.error) {
        const funds = refreshed.profiles.filter(
          (p) => !p.strategy && p.preset !== "custom",
        );
        setProfiles(funds);
        const updated = funds.find((p) => p.id === active.id);
        if (updated) {
          setActive(updated);
          populateForm(updated);
        }
      }
      setMessage("Changes saved");
    }
    setTimeout(() => setMessage(null), 3000);
    setSaving(false);
  }

  function handleReset() {
    if (active) populateForm(active);
  }

  function toggleGroup(title: string) {
    setOpenGroups((prev) => ({ ...prev, [title]: !prev[title] }));
  }

  /* ── Loading / Error states ─────────────────────────────────────── */

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="card-panel rounded-xl p-8 text-center text-[#a1a8b3]">
          Loading funds...
        </div>
      </div>
    );
  }

  if (loadError || profiles.length === 0) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="card-panel rounded-xl p-8 text-center text-[#a1a8b3]">
          {loadError
            ? `Unable to load funds: ${loadError}`
            : "No funds configured yet."}
        </div>
      </div>
    );
  }

  /* ── Main render ────────────────────────────────────────────────── */

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <h2 className="text-2xl font-bold tracking-tight">Choose Your Fund</h2>
      <p className="mt-1 text-sm text-[#a1a8b3]">
        Select a fund strategy that matches your risk tolerance. The bot will
        trade according to the fund&apos;s parameters. Changes take effect on the
        next pipeline cycle.
      </p>

      {/* Fund cards */}
      <div className="mt-8 grid gap-5 sm:grid-cols-3">
        {profiles.map((profile) => {
          const meta = FUND_META[profile.preset] ?? FUND_META.moderate;
          const isActive = profile.is_active;
          return (
            <button
              key={profile.id}
              onClick={() => handleSelectFund(profile)}
              className={`group relative rounded-xl p-6 text-left transition-all ${
                isActive
                  ? `card-panel border ${meta.border} ring-1 ring-inset ring-white/5`
                  : "card-panel border border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              {/* Icon + badge row */}
              <div className="flex items-center justify-between">
                <div className={`rounded-lg p-2 ${meta.bg} ${meta.accent}`}>
                  <FundIcon type={meta.icon} />
                </div>
                {isActive && (
                  <span className="rounded-full bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                    Active
                  </span>
                )}
              </div>

              {/* Fund name */}
              <h3 className="mt-4 text-sm font-semibold text-[#eceef0]">
                {profile.name}
              </h3>
              <p className={`mt-0.5 text-xs font-medium ${meta.accent}`}>
                {meta.tagline}
              </p>

              {/* Description */}
              <p className="mt-3 text-xs leading-relaxed text-[#a1a8b3]">
                {profile.description}
              </p>

              {/* Key stats */}
              <div className="mt-5 space-y-2 border-t border-[#22262d] pt-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-[#a1a8b3]">Target return</span>
                  <span className="text-lg font-bold text-[#eceef0]">
                    {profile.target_annual_return_pct}%
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-[#a1a8b3]">Max exposure</span>
                  <span className="text-sm font-semibold text-[#eceef0]">
                    ${profile.max_total_exposure_dollars}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-[#a1a8b3]">Min edge</span>
                  <span className="text-sm font-semibold text-[#eceef0]">
                    {profile.min_edge_pct}%
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-[#a1a8b3]">Max positions</span>
                  <span className="text-sm font-semibold text-[#eceef0]">
                    {profile.max_open_positions}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Status message */}
      {message && (
        <div className="mt-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 text-sm text-emerald-400">
          {message}
        </div>
      )}

      {/* Advanced toggle */}
      <div className="mt-10">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm font-medium text-[#a1a8b3] hover:text-[#eceef0] transition-colors"
        >
          <span>{showAdvanced ? "\u25B2" : "\u25BC"}</span>
          <span>Advanced Parameters</span>
          <span className="text-xs">
            — Fine-tune the active fund&apos;s settings
          </span>
        </button>
      </div>

      {/* Advanced parameter groups */}
      {showAdvanced && active && (
        <div className="mt-4 space-y-4">
          <p className="text-xs text-[#a1a8b3]">
            Editing parameters for <strong className="text-[#eceef0]">{active.name}</strong>.
            Saving will apply to this fund only.
          </p>

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

          {/* Save / Reset */}
          <div className="flex items-center gap-4 pb-8">
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
          </div>
        </div>
      )}
    </div>
  );
}
