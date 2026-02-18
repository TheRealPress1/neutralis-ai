"use client";

import { useEffect, useState } from "react";
import { getApiKeys } from "@/app/actions/api-keys";

export default function ConnectionsPanel() {
  const [polyConnected, setPolyConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const result = await getApiKeys();
      const keys = result.keys ?? [];
      setPolyConnected(keys.some((k: { platform: string }) => k.platform === "polymarket"));
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="card-panel rounded-xl p-6">
      <h2 className="text-lg font-semibold text-[#e8e9ea] mb-4">
        Exchange Connections
      </h2>

      {/* Kalshi - always connected (public API) */}
      <div className="flex items-center justify-between py-3 border-b border-[#1a1d21]">
        <div>
          <p className="font-medium text-[#e8e9ea]">Kalshi</p>
          <p className="text-xs text-[#9ca3af] mt-0.5">Public API — no auth required</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Connected
        </span>
      </div>

      {/* Polymarket */}
      <div className="py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-[#e8e9ea]">Polymarket</p>
            <p className="text-xs text-[#9ca3af] mt-0.5">
              {polyConnected
                ? "CLOB API credentials configured"
                : "Not configured — add credentials in Onboarding"}
            </p>
          </div>
          {loading ? (
            <div className="h-6 w-20 animate-pulse rounded-full bg-[#1a1d21]" />
          ) : polyConnected ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1a1d21] px-2.5 py-1 text-xs font-medium text-[#9ca3af]">
              Not configured
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
