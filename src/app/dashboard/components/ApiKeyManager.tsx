"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import {
  getApiKeys,
  saveApiKeys,
  saveWalletAddress,
  deleteApiKey,
  validateKalshiKey,
  validatePolymarketKey,
  testConnection,
  type ApiKeyData,
} from "@/app/actions/api-keys";

const INPUT_CLASS =
  "w-full rounded-lg bg-[#1a1d21] border border-[#2a2d31] px-4 py-3 text-[#e8e9ea] placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#e8e9ea]/20 focus:border-[#e8e9ea]/40 transition-colors text-sm";

interface StoredKey {
  id: number;
  platform: string;
  api_key_id: string;
  api_secret: string;
  private_key_pem: string;
  is_valid: boolean;
  updated_at: string;
}

function mask(value: string, visibleChars = 6) {
  if (!value || value.length <= visibleChars) return value;
  return value.slice(0, visibleChars) + "..." + value.slice(-4);
}

function maskAddress(address: string) {
  if (!address || address.length < 10) return address;
  return address.slice(0, 6) + "..." + address.slice(-4);
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function PolymarketHelpTooltip() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#2a2d31] text-[10px] font-medium text-[#6b7280] hover:text-[#e8e9ea] hover:border-[#e8e9ea]/40 transition-colors"
      >
        ?
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 w-72 rounded-lg bg-[#14161a] border border-[#2a2d31] p-4 shadow-xl">
            <p className="text-xs font-medium text-[#e8e9ea] mb-2">
              How to connect Polymarket
            </p>
            <ol className="text-xs text-[#9ca3af] space-y-2 list-decimal list-inside">
              <li>
                <span className="font-medium text-[#e8e9ea]">Connect your wallet</span>{" "}
                &mdash; use MetaMask to link the wallet associated with your
                Polymarket account. If you signed up via email, export your key at{" "}
                <a
                  href="https://reveal.magic.link/polymarket"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#e8e9ea] underline underline-offset-2 hover:text-white"
                >
                  reveal.magic.link/polymarket
                </a>{" "}
                and import it into MetaMask first.
              </li>
              <li>
                <span className="font-medium text-[#e8e9ea]">Get CLOB credentials</span>{" "}
                &mdash; go to{" "}
                <a
                  href="https://polymarket.com/settings?tab=builder"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#e8e9ea] underline underline-offset-2 hover:text-white"
                >
                  polymarket.com &rarr; Settings &rarr; Builder
                </a>{" "}
                and click &quot;Create New&quot; to generate your API Key, Secret, and
                Passphrase.
              </li>
            </ol>
          </div>
        </>
      )}
    </div>
  );
}

export default function ApiKeyManager() {
  const [keys, setKeys] = useState<StoredKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [testing, setTesting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wallet state from wagmi
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();

  // Form state
  const [kalshiKeyId, setKalshiKeyId] = useState("");
  const [kalshiPem, setKalshiPem] = useState("");
  const [polyKey, setPolyKey] = useState("");
  const [polySecret, setPolySecret] = useState("");
  const [polyPassphrase, setPolyPassphrase] = useState("");

  async function load() {
    const result = await getApiKeys();
    if (result.error) setError(result.error);
    setKeys((result.keys as StoredKey[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    async function init() {
      const result = await getApiKeys();
      if (result.error) setError(result.error);
      setKeys((result.keys as StoredKey[]) ?? []);
      setLoading(false);
    }
    init();
  }, []);

  // Save wallet address when connected
  useEffect(() => {
    if (isConnected && address) {
      startTransition(async () => {
        const result = await saveWalletAddress(address);
        if (result.error) setError(result.error);
        else await load();
      });
    }
  }, [isConnected, address]);

  const kalshiKey = keys.find((k) => k.platform === "kalshi");
  const polymarketKey = keys.find((k) => k.platform === "polymarket");
  const walletKey = keys.find((k) => k.platform === "polymarket_wallet");
  const savedWalletAddress = walletKey?.api_key_id;

  // Determine overall Polymarket connection status
  const polyFullyConnected = !!polymarketKey && (!!savedWalletAddress || isConnected);
  const polyPartial = !!polymarketKey || !!savedWalletAddress || isConnected;

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setKalshiPem(text);
  }

  function handleSave(platform: "kalshi" | "polymarket") {
    setError(null);
    setSuccess(null);

    const keyData: ApiKeyData[] = [];

    if (platform === "kalshi") {
      if (!kalshiKeyId || !kalshiPem) {
        setError("Both API Key ID and Private Key are required.");
        return;
      }
      keyData.push({
        platform: "kalshi",
        api_key_id: kalshiKeyId.trim(),
        api_secret: "",
        private_key_pem: kalshiPem.trim(),
      });
    } else {
      if (!polyKey || !polySecret || !polyPassphrase) {
        setError("API Key, API Secret, and Passphrase are all required.");
        return;
      }
      keyData.push({
        platform: "polymarket",
        api_key_id: polyKey.trim(),
        api_secret: polySecret.trim(),
        private_key_pem: polyPassphrase.trim(),
      });
    }

    startTransition(async () => {
      // Validate before saving
      let validation: { valid: boolean; error?: string };
      if (platform === "kalshi") {
        validation = await validateKalshiKey(kalshiKeyId.trim(), kalshiPem.trim());
      } else {
        validation = await validatePolymarketKey(
          polyKey.trim(),
          polySecret.trim(),
          polyPassphrase.trim(),
        );
      }

      // Save regardless of validation (user may want to save for later)
      const result = await saveApiKeys(keyData);
      if (result.error) {
        setError(result.error);
        return;
      }

      setEditing(null);
      setKalshiKeyId("");
      setKalshiPem("");
      setPolyKey("");
      setPolySecret("");
      setPolyPassphrase("");
      await load();

      if (validation.valid) {
        setSuccess(`${platform === "kalshi" ? "Kalshi" : "Polymarket"} credentials saved and verified`);
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(
          `Credentials saved but validation failed: ${validation.error}. You can try again with Test Connection.`,
        );
      }
    });
  }

  async function handleTestConnection(platform: string) {
    setError(null);
    setSuccess(null);
    setTesting(platform);

    try {
      const result = await testConnection(platform);
      if (result.valid) {
        setSuccess(`${platform === "kalshi" ? "Kalshi" : "Polymarket"} connection verified`);
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(`Connection test failed: ${result.error}`);
      }
      await load(); // Reload to update is_valid status
    } catch {
      setError("Connection test failed unexpectedly");
    } finally {
      setTesting(null);
    }
  }

  function handleRemove(platform: string) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await deleteApiKey(platform);
      if (result.error) {
        setError(result.error);
      } else {
        setEditing(null);
        await load();
      }
    });
  }

  function handleDisconnectWallet() {
    disconnect();
    startTransition(async () => {
      await deleteApiKey("polymarket_wallet");
      await load();
    });
  }

  if (loading) {
    return (
      <div className="card-panel rounded-xl p-6">
        <p className="text-sm text-[#9ca3af]">Loading API keys...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-[family-name:var(--font-italiana)] text-xl font-normal tracking-[0.04em]">
          Exchange Connections
        </h2>
        <p className="text-sm text-[#a1a8b3] mt-1">
          Connect your Kalshi and Polymarket accounts to enable live trading.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-400">
          {success}
        </div>
      )}

      {/* Kalshi */}
      <div className="card-panel rounded-xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-medium text-[#eceef0]">Kalshi</h3>
          {kalshiKey ? (
            <span
              className={`text-xs font-medium rounded-full px-2.5 py-0.5 border ${
                kalshiKey.is_valid
                  ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                  : "text-amber-400 bg-amber-500/10 border-amber-500/20"
              }`}
            >
              {kalshiKey.is_valid ? "Verified" : "Unverified"}
            </span>
          ) : (
            <span className="text-xs font-medium text-[#a1a8b3] bg-[#1a1d21] border border-[#22262d] rounded-full px-2.5 py-0.5">
              Not configured
            </span>
          )}
        </div>

        {kalshiKey && editing !== "kalshi" ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-[#a1a8b3]">
              Key ID:{" "}
              <span className="font-mono text-[#e8e9ea]">
                {mask(kalshiKey.api_key_id)}
              </span>
            </p>
            <p className="text-xs text-[#a1a8b3]">
              Private key: <span className="text-[#e8e9ea]">configured</span>
            </p>
            {kalshiKey.updated_at && (
              <p className="text-xs text-[#6b7280]">
                Updated {timeAgo(kalshiKey.updated_at)}
              </p>
            )}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => handleTestConnection("kalshi")}
                disabled={testing === "kalshi"}
                className="rounded-lg border border-[#2a2d31] bg-[#1a1d21] px-3 py-1.5 text-xs font-medium text-[#e8e9ea] hover:border-[#e8e9ea]/30 hover:bg-[#22262d] disabled:opacity-50 transition-colors"
              >
                {testing === "kalshi" ? "Testing..." : "Test Connection"}
              </button>
              <button
                onClick={() => setEditing("kalshi")}
                className="text-xs text-[#a1a8b3] hover:text-[#eceef0] transition-colors px-2"
              >
                Update
              </button>
              <button
                onClick={() => handleRemove("kalshi")}
                disabled={isPending}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          (editing === "kalshi" || !kalshiKey) && (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-[#9ca3af]">
                Generate an API key at{" "}
                <a
                  href="https://kalshi.com/account/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#e8e9ea] underline underline-offset-2 hover:text-white"
                >
                  kalshi.com/account/api
                </a>
              </p>
              <div>
                <label className="block text-xs font-medium mb-1.5 text-[#a1a8b3]">
                  API Key ID
                </label>
                <input
                  type="text"
                  value={kalshiKeyId}
                  onChange={(e) => setKalshiKeyId(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="e.g. 6cd6375f-c6a7-440a-9f6f-c41c3bc68ff0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5 text-[#a1a8b3]">
                  RSA Private Key (PEM)
                </label>
                <textarea
                  value={kalshiPem}
                  onChange={(e) => setKalshiPem(e.target.value)}
                  rows={5}
                  className={`${INPUT_CLASS} font-mono text-xs`}
                  placeholder={"-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pem,.key,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-1.5 text-xs text-[#a1a8b3] hover:text-[#e8e9ea] transition-colors underline underline-offset-2"
                >
                  or upload a .pem file
                </button>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => handleSave("kalshi")}
                  disabled={isPending}
                  className="rounded-lg bg-[#e8e9ea] px-4 py-2 text-xs font-medium text-[#050608] hover:bg-[#c0c5cb] disabled:opacity-50 transition-colors"
                >
                  {isPending ? "Validating & Saving..." : "Save & Validate"}
                </button>
                {editing === "kalshi" && (
                  <button
                    onClick={() => setEditing(null)}
                    className="text-xs text-[#a1a8b3] hover:text-[#eceef0] transition-colors px-3"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )
        )}
      </div>

      {/* Polymarket */}
      <div className="card-panel rounded-xl p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center">
            <h3 className="font-medium text-[#eceef0]">Polymarket</h3>
            <PolymarketHelpTooltip />
          </div>
          {polyFullyConnected ? (
            <span
              className={`text-xs font-medium rounded-full px-2.5 py-0.5 border ${
                polymarketKey?.is_valid
                  ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                  : "text-amber-400 bg-amber-500/10 border-amber-500/20"
              }`}
            >
              {polymarketKey?.is_valid ? "Verified" : "Unverified"}
            </span>
          ) : polyPartial ? (
            <span className="text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-0.5">
              Partial
            </span>
          ) : (
            <span className="text-xs font-medium text-[#a1a8b3] bg-[#1a1d21] border border-[#22262d] rounded-full px-2.5 py-0.5">
              Not configured
            </span>
          )}
        </div>

        {/* Step 1: Wallet Connection */}
        <div className="mt-4">
          <p className="text-xs font-medium text-[#a1a8b3] mb-2">
            Step 1 — Connect Wallet
          </p>

          {isConnected && address ? (
            <div className="flex items-center justify-between rounded-lg bg-[#1a1d21] border border-[#2a2d31] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="font-mono text-sm text-[#e8e9ea]">
                  {maskAddress(address)}
                </span>
                <span className="text-xs text-[#6b7280]">Polygon</span>
              </div>
              <button
                onClick={handleDisconnectWallet}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : savedWalletAddress && !isConnected ? (
            <div className="flex items-center justify-between rounded-lg bg-[#1a1d21] border border-[#2a2d31] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                <span className="font-mono text-sm text-[#e8e9ea]">
                  {maskAddress(savedWalletAddress)}
                </span>
                <span className="text-xs text-[#6b7280]">saved</span>
              </div>
              <div className="flex gap-2">
                {connectors.map((connector) => (
                  <button
                    key={connector.uid}
                    onClick={() => connect({ connector })}
                    disabled={isConnecting}
                    className="text-xs text-[#a1a8b3] hover:text-[#eceef0] transition-colors"
                  >
                    Reconnect
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {connectors.map((connector) => (
                <button
                  key={connector.uid}
                  onClick={() => connect({ connector })}
                  disabled={isConnecting}
                  className="rounded-lg border border-[#2a2d31] bg-[#1a1d21] px-4 py-2.5 text-xs font-medium text-[#e8e9ea] hover:border-[#e8e9ea]/30 hover:bg-[#22262d] disabled:opacity-50 transition-colors"
                >
                  {isConnecting ? "Connecting..." : connector.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Step 2: CLOB API Credentials */}
        <div className="mt-5 pt-4 border-t border-[#1a1d21]">
          <p className="text-xs font-medium text-[#a1a8b3] mb-2">
            Step 2 — CLOB API Credentials
          </p>

          {polymarketKey && editing !== "polymarket" ? (
            <div className="space-y-2">
              <p className="text-xs text-[#a1a8b3]">
                API Key:{" "}
                <span className="font-mono text-[#e8e9ea]">
                  {mask(polymarketKey.api_key_id)}
                </span>
              </p>
              <p className="text-xs text-[#a1a8b3]">
                Secret: <span className="text-[#e8e9ea]">configured</span>
              </p>
              <p className="text-xs text-[#a1a8b3]">
                Passphrase: <span className="text-[#e8e9ea]">configured</span>
              </p>
              {polymarketKey.updated_at && (
                <p className="text-xs text-[#6b7280]">
                  Updated {timeAgo(polymarketKey.updated_at)}
                </p>
              )}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleTestConnection("polymarket")}
                  disabled={testing === "polymarket"}
                  className="rounded-lg border border-[#2a2d31] bg-[#1a1d21] px-3 py-1.5 text-xs font-medium text-[#e8e9ea] hover:border-[#e8e9ea]/30 hover:bg-[#22262d] disabled:opacity-50 transition-colors"
                >
                  {testing === "polymarket" ? "Testing..." : "Test Connection"}
                </button>
                <button
                  onClick={() => setEditing("polymarket")}
                  className="text-xs text-[#a1a8b3] hover:text-[#eceef0] transition-colors px-2"
                >
                  Update
                </button>
                <button
                  onClick={() => handleRemove("polymarket")}
                  disabled={isPending}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            (editing === "polymarket" || !polymarketKey) && (
              <div className="space-y-3">
                <p className="text-xs text-[#9ca3af]">
                  Get your CLOB credentials from{" "}
                  <a
                    href="https://polymarket.com/settings?tab=builder"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#e8e9ea] underline underline-offset-2 hover:text-white"
                  >
                    polymarket.com &rarr; Settings &rarr; Builder &rarr; Create New
                  </a>
                </p>
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-[#a1a8b3]">
                    API Key
                  </label>
                  <input
                    type="text"
                    value={polyKey}
                    onChange={(e) => setPolyKey(e.target.value)}
                    className={INPUT_CLASS}
                    placeholder="Your Polymarket CLOB API key"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-[#a1a8b3]">
                    API Secret
                  </label>
                  <input
                    type="password"
                    value={polySecret}
                    onChange={(e) => setPolySecret(e.target.value)}
                    className={INPUT_CLASS}
                    placeholder="Your Polymarket CLOB API secret"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-[#a1a8b3]">
                    Passphrase
                  </label>
                  <input
                    type="password"
                    value={polyPassphrase}
                    onChange={(e) => setPolyPassphrase(e.target.value)}
                    className={INPUT_CLASS}
                    placeholder="Your Polymarket CLOB passphrase"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleSave("polymarket")}
                    disabled={isPending}
                    className="rounded-lg bg-[#e8e9ea] px-4 py-2 text-xs font-medium text-[#050608] hover:bg-[#c0c5cb] disabled:opacity-50 transition-colors"
                  >
                    {isPending ? "Validating & Saving..." : "Save & Validate"}
                  </button>
                  {editing === "polymarket" && (
                    <button
                      onClick={() => setEditing(null)}
                      className="text-xs text-[#a1a8b3] hover:text-[#eceef0] transition-colors px-3"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
