"use client";

import { useEffect, useState, useCallback } from "react";
import type { RiskProfile } from "@/types/api";
import { getActiveRiskProfile, updateRiskProfile } from "@/app/actions/dashboard";

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
      {
        key: "max_position_dollars",
        label: "Max Position Size",
        unit: "$",
        step: 5,
        min: 1,
        max: 500,
        description: "Maximum dollars allocated to a single position",
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
];

/* ── Helpers ─────────────────────────────────────────────────────── */

function toDisplay(value: number, def: ParamDef): number {
  return def.displayMultiplier ? value * def.displayMultiplier : value;
}

function fromDisplay(display: number, def: ParamDef): number {
  return def.displayMultiplier ? display / def.displayMultiplier : display;
}

/* ── Component ───────────────────────────────────────────────────── */

export default function RiskProfileEditor() {
  const [active, setActive] = useState<RiskProfile | null>(null);
  const [form, setForm] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      const result = await getActiveRiskProfile();
      if (result.data) {
        setActive(result.data);
        populateForm(result.data);
      }
    } catch {
      /* profile may not exist yet */
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

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
      const result = await updateRiskProfile(active.id, updates);
      if (result.error) throw new Error(result.error);
      if (result.data) {
        setActive(result.data);
        populateForm(result.data);
      }
      setMessage("Settings saved");
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (active) populateForm(active);
  }

  if (!active) {
    return (
      <div className="mx-auto max-w-5xl px-6">
        <div className="card-panel rounded-xl p-8 text-center text-[#9ca3af]">
          Loading strategy configuration...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6">
      <h2 className="font-[family-name:var(--font-italiana)] text-2xl font-normal tracking-[0.06em]">
        Strategy Configuration
      </h2>
      <p className="mt-2 text-sm text-[#9ca3af]">
        Configure pipeline thresholds, position limits, and signal filters.
        Changes take effect on the next pipeline cycle.
      </p>

      {/* ── Parameter Groups ──────────────────────────────────── */}
      <div className="mt-8 space-y-4">
        {PARAM_GROUPS.map((group) => (
          <div key={group.title} className="card-panel rounded-xl">
            <div className="px-6 py-4">
              <h3 className="font-[family-name:var(--font-cormorant)] text-base font-medium">{group.title}</h3>
              <p className="mt-0.5 text-xs text-[#9ca3af]">
                {group.description}
              </p>
            </div>

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
          </div>
        ))}
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
