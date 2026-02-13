"use client";

import { useEffect, useState, useCallback } from "react";
import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";
import type { PolymarketConnectionStatus } from "@/types/api";
import {
  connectPolymarket,
  fetchPolymarketStatus,
  storePolymarketCreds,
} from "@/lib/api";

const SIGN_MESSAGE =
  "Authorize Neutralis to connect to Polymarket CLOB (no gas, no transaction)";

export default function ConnectionsPanel() {
  const { address, isConnected: walletConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  const [status, setStatus] = useState<PolymarketConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Advanced L2 creds
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [savingCreds, setSavingCreds] = useState(false);
  const [credsSaved, setCredsSaved] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const s = await fetchPolymarketStatus();
      setStatus(s);
    } catch {
      // Backend might not be running; that's OK
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function handleConnect() {
    if (!walletConnected || !address) return;
    setConnecting(true);
    setError(null);
    try {
      const signature = await signMessageAsync({ message: SIGN_MESSAGE });
      await connectPolymarket(address, signature, SIGN_MESSAGE);
      await loadStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  }

  async function handleSaveCreds() {
    if (!status?.wallet_address) return;
    setSavingCreds(true);
    setError(null);
    try {
      await storePolymarketCreds(
        status.wallet_address,
        apiKey,
        apiSecret,
        passphrase,
      );
      setCredsSaved(true);
      setApiKey("");
      setApiSecret("");
      setPassphrase("");
      await loadStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save credentials");
    } finally {
      setSavingCreds(false);
    }
  }

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
              {status?.connected
                ? `Wallet: ${status.wallet_address?.slice(0, 6)}...${status.wallet_address?.slice(-4)}`
                : "Wallet signature required"}
            </p>
          </div>
          {loading ? (
            <div className="h-6 w-20 animate-pulse rounded-full bg-[#1a1d21]" />
          ) : status?.connected ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Connected
              </span>
              {status.has_l2_creds && (
                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                  L2
                </span>
              )}
            </div>
          ) : !walletConnected ? (
            <div className="flex gap-2">
              {connectors.map((connector) => (
                <button
                  key={connector.uid}
                  onClick={() => connect({ connector })}
                  className="rounded border border-[#22262d] px-3 py-1.5 text-xs font-medium text-[#a1a8b3] transition-colors hover:border-[#c0c5cb] hover:text-[#eceef0]"
                >
                  {connector.name}
                </button>
              ))}
            </div>
          ) : (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="rounded border border-[#22262d] px-3 py-1.5 text-xs font-medium text-[#a1a8b3] transition-colors hover:border-[#c0c5cb] hover:text-[#eceef0] disabled:opacity-50"
            >
              {connecting ? "Signing..." : "Sign & Connect"}
            </button>
          )}
        </div>

        {/* Disconnect button */}
        {walletConnected && !status?.connected && (
          <button
            onClick={() => disconnect()}
            className="mt-2 text-xs text-[#9ca3af] hover:text-red-400 transition-colors"
          >
            Disconnect wallet
          </button>
        )}

        {error && (
          <p className="mt-2 text-xs text-red-400">{error}</p>
        )}

        {/* Advanced L2 credentials */}
        {status?.connected && (
          <div className="mt-4 pt-3 border-t border-[#1a1d21]">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1 text-xs text-[#9ca3af] hover:text-[#e8e9ea] transition-colors"
            >
              <span
                className="inline-block transition-transform"
                style={{
                  transform: showAdvanced ? "rotate(90deg)" : "rotate(0deg)",
                }}
              >
                ▶
              </span>
              Advanced: L2 API Credentials
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-3">
                <p className="text-xs text-[#9ca3af]">
                  Optional. Required for future order execution on Polymarket CLOB.
                  Credentials are encrypted at rest.
                </p>
                <input
                  type="password"
                  placeholder="API Key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full rounded border border-[#22262d] bg-[#0d0f12] px-3 py-2 text-xs text-[#e8e9ea] placeholder-[#555] focus:border-[#9ca3af] focus:outline-none"
                />
                <input
                  type="password"
                  placeholder="API Secret"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  className="w-full rounded border border-[#22262d] bg-[#0d0f12] px-3 py-2 text-xs text-[#e8e9ea] placeholder-[#555] focus:border-[#9ca3af] focus:outline-none"
                />
                <input
                  type="password"
                  placeholder="Passphrase"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="w-full rounded border border-[#22262d] bg-[#0d0f12] px-3 py-2 text-xs text-[#e8e9ea] placeholder-[#555] focus:border-[#9ca3af] focus:outline-none"
                />
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSaveCreds}
                    disabled={savingCreds || !apiKey || !apiSecret || !passphrase}
                    className="rounded bg-[#1a1f27] px-4 py-1.5 text-xs font-medium text-[#e8e9ea] transition-colors hover:bg-[#22282f] disabled:opacity-50"
                  >
                    {savingCreds ? "Saving..." : "Save Credentials"}
                  </button>
                  {credsSaved && (
                    <span className="text-xs text-emerald-400">
                      L2 Creds Stored
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
