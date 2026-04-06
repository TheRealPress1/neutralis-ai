"use client";

import { useEffect, useState } from "react";
import { getApiKeys } from "@/app/actions/api-keys";

export default function ConnectionsPanel() {
  const [polyUSConnected, setPolyUSConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const result = await getApiKeys();
      const keys = result.keys ?? [];
      setPolyUSConnected(keys.some((k: { platform: string }) => k.platform === "polymarket_us"));
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="hud-panel rounded-xl p-6">
      <h2 className="text-lg font-semibold text-text-primary mb-4">
        Exchange Connections
      </h2>

      {/* Kalshi - always connected (public API) */}
      <div className="flex items-center justify-between py-3 border-b border-border">
        <div>
          <p className="font-medium text-text-primary">Kalshi</p>
          <p className="text-xs text-text-secondary mt-0.5">Public API — no auth required</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-neon-green/10 px-2.5 py-1 text-xs font-medium text-neon-green">
          <span className="h-1.5 w-1.5 rounded-full bg-neon-green" />
          Connected
        </span>
      </div>

      {/* Polymarket US (CFTC-regulated) */}
      <div className="py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-text-primary">
              Polymarket US
              <span className="ml-1.5 text-[10px] font-normal text-text-secondary">CFTC</span>
            </p>
            <p className="text-xs text-text-secondary mt-0.5">
              {polyUSConnected
                ? "Ed25519 credentials configured"
                : (<>
                    Not configured &mdash; get API keys at{" "}
                    <a
                      href="https://polymarket.us/developer"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-text-primary underline underline-offset-2 hover:text-white"
                    >
                      polymarket.us/developer
                    </a>
                  </>)}
            </p>
          </div>
          {loading ? (
            <div className="h-6 w-20 animate-pulse rounded-full bg-bg-elevated" />
          ) : polyUSConnected ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-neon-green/10 px-2.5 py-1 text-xs font-medium text-neon-green">
              <span className="h-1.5 w-1.5 rounded-full bg-neon-green" />
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-bg-elevated px-2.5 py-1 text-xs font-medium text-text-secondary">
              Not configured
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
