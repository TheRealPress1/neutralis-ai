"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import {
  getApiKeys,
  saveApiKeys,
  deleteApiKey,
  validateKalshiKey,
  validatePolymarketUSKey,
  testConnection,
  type ApiKeyData,
} from "@/app/actions/api-keys";

const INPUT_CLASS =
  "w-full rounded-lg bg-bg-primary border border-border px-4 py-3 text-text-primary font-mono placeholder:text-text-secondary focus:outline-none focus:border-neon-blue/50 focus:shadow-[0_0_8px_rgba(0,212,255,0.1)] transition-all text-sm";

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

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
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

  // Form state — Kalshi
  const [kalshiKeyId, setKalshiKeyId] = useState("");
  const [kalshiPem, setKalshiPem] = useState("");

  // Form state — Polymarket US
  const [polyUSKeyId, setPolyUSKeyId] = useState("");
  const [polyUSSecret, setPolyUSSecret] = useState("");

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

  const kalshiKey = keys.find((k) => k.platform === "kalshi");
  const polyUSKey = keys.find((k) => k.platform === "polymarket_us");

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setKalshiPem(text);
  }

  function handleSave(platform: "kalshi" | "polymarket_us") {
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
      if (!polyUSKeyId || !polyUSSecret) {
        setError("Both Key ID and Secret Key are required.");
        return;
      }
      keyData.push({
        platform: "polymarket_us",
        api_key_id: polyUSKeyId.trim(),
        api_secret: polyUSSecret.trim(),
        private_key_pem: "",
      });
    }

    startTransition(async () => {
      // Validate before saving
      let validation: { valid: boolean; error?: string };
      if (platform === "kalshi") {
        validation = await validateKalshiKey(kalshiKeyId.trim(), kalshiPem.trim());
      } else {
        validation = await validatePolymarketUSKey(
          polyUSKeyId.trim(),
          polyUSSecret.trim(),
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
      setPolyUSKeyId("");
      setPolyUSSecret("");
      await load();

      const label = platform === "kalshi" ? "Kalshi" : "Polymarket US";
      if (validation.valid) {
        setSuccess(`${label} credentials saved and verified`);
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
      const label = platform === "kalshi" ? "Kalshi" : "Polymarket US";
      if (result.valid) {
        setSuccess(`${label} connection verified`);
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(`Connection test failed: ${result.error}`);
      }
      await load();
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

  if (loading) {
    return (
      <div className="hud-panel rounded-xl p-6">
        <p className="text-sm text-text-secondary">Loading API keys...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-[family-name:var(--font-italiana)] text-xl font-normal tracking-[0.04em]">
          Exchange Connections
        </h2>
        <p className="text-sm text-text-secondary mt-1">
          Connect your Kalshi and Polymarket US accounts to enable live trading.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-neon-red">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-neon-green/10 border border-neon-green/20 px-4 py-3 text-sm text-neon-green">
          {success}
        </div>
      )}

      {/* Kalshi */}
      <div className="hud-panel rounded-xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-medium text-text-primary">Kalshi</h3>
          {kalshiKey ? (
            <span
              className={`text-xs font-medium rounded-full px-2.5 py-0.5 border ${
                kalshiKey.is_valid
                  ? "text-neon-green bg-neon-green/10 border-neon-green/20"
                  : "text-amber-400 bg-amber-500/10 border-amber-500/20"
              }`}
            >
              {kalshiKey.is_valid ? "Verified" : "Unverified"}
            </span>
          ) : (
            <span className="text-xs font-medium text-text-secondary bg-bg-elevated border border-border rounded-full px-2.5 py-0.5">
              Not configured
            </span>
          )}
        </div>

        {kalshiKey && editing !== "kalshi" ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-text-secondary">
              Key ID:{" "}
              <span className="font-mono text-text-primary">
                {mask(kalshiKey.api_key_id)}
              </span>
            </p>
            <p className="text-xs text-text-secondary">
              Private key: <span className="text-text-primary">configured</span>
            </p>
            {kalshiKey.updated_at && (
              <p className="text-xs text-text-secondary">
                Updated {timeAgo(kalshiKey.updated_at)}
              </p>
            )}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => handleTestConnection("kalshi")}
                disabled={testing === "kalshi"}
                className="rounded-lg border border-neon-blue/30 bg-neon-blue/10 px-4 py-2 text-sm font-mono text-neon-blue transition-all hover:bg-neon-blue/20"
              >
                {testing === "kalshi" ? "Testing..." : "Test Connection"}
              </button>
              <button
                onClick={() => setEditing("kalshi")}
                className="text-xs text-text-secondary hover:text-text-primary transition-colors px-2"
              >
                Update
              </button>
              <button
                onClick={() => handleRemove("kalshi")}
                disabled={isPending}
                className="rounded-lg border border-neon-red/30 px-4 py-2 text-sm font-mono text-neon-red transition-all hover:bg-neon-red/10"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          (editing === "kalshi" || !kalshiKey) && (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-text-secondary">
                Generate an API key at{" "}
                <a
                  href="https://kalshi.com/account/profile"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-primary underline underline-offset-2 hover:text-white"
                >
                  kalshi.com/account/profile
                </a>
              </p>
              <div>
                <label className="block text-xs font-medium mb-1.5 text-text-secondary">
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
                <label className="block text-xs font-medium mb-1.5 text-text-secondary">
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
                  className="mt-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors underline underline-offset-2"
                >
                  or upload a .pem file
                </button>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => handleSave("kalshi")}
                  disabled={isPending}
                  className="rounded-lg border border-neon-green/30 bg-neon-green/10 px-4 py-2.5 text-sm font-mono font-medium text-neon-green transition-all hover:bg-neon-green/20 hover:shadow-[0_0_12px_rgba(0,255,170,0.1)] disabled:opacity-50"
                >
                  {isPending ? "Validating & Saving..." : "Save & Validate"}
                </button>
                {editing === "kalshi" && (
                  <button
                    onClick={() => setEditing(null)}
                    className="text-xs text-text-secondary hover:text-text-primary transition-colors px-3"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )
        )}
      </div>

      {/* Polymarket US */}
      <div className="hud-panel rounded-xl p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <h3 className="font-medium text-text-primary">Polymarket US</h3>
            <span className="text-[10px] font-normal text-text-secondary">CFTC</span>
          </div>
          {polyUSKey ? (
            <span
              className={`text-xs font-medium rounded-full px-2.5 py-0.5 border ${
                polyUSKey.is_valid
                  ? "text-neon-green bg-neon-green/10 border-neon-green/20"
                  : "text-amber-400 bg-amber-500/10 border-amber-500/20"
              }`}
            >
              {polyUSKey.is_valid ? "Verified" : "Unverified"}
            </span>
          ) : (
            <span className="text-xs font-medium text-text-secondary bg-bg-elevated border border-border rounded-full px-2.5 py-0.5">
              Not configured
            </span>
          )}
        </div>

        {polyUSKey && editing !== "polymarket_us" ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-text-secondary">
              Key ID:{" "}
              <span className="font-mono text-text-primary">
                {mask(polyUSKey.api_key_id)}
              </span>
            </p>
            <p className="text-xs text-text-secondary">
              Secret Key: <span className="text-text-primary">configured</span>
            </p>
            {polyUSKey.updated_at && (
              <p className="text-xs text-text-secondary">
                Updated {timeAgo(polyUSKey.updated_at)}
              </p>
            )}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => handleTestConnection("polymarket_us")}
                disabled={testing === "polymarket_us"}
                className="rounded-lg border border-neon-blue/30 bg-neon-blue/10 px-4 py-2 text-sm font-mono text-neon-blue transition-all hover:bg-neon-blue/20"
              >
                {testing === "polymarket_us" ? "Testing..." : "Test Connection"}
              </button>
              <button
                onClick={() => setEditing("polymarket_us")}
                className="text-xs text-text-secondary hover:text-text-primary transition-colors px-2"
              >
                Update
              </button>
              <button
                onClick={() => handleRemove("polymarket_us")}
                disabled={isPending}
                className="rounded-lg border border-neon-red/30 px-4 py-2 text-sm font-mono text-neon-red transition-all hover:bg-neon-red/10"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          (editing === "polymarket_us" || !polyUSKey) && (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-text-secondary">
                Get your API credentials at{" "}
                <a
                  href="https://polymarket.us/developer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-primary underline underline-offset-2 hover:text-white"
                >
                  polymarket.us/developer
                </a>
              </p>
              <div>
                <label className="block text-xs font-medium mb-1.5 text-text-secondary">
                  Key ID
                </label>
                <input
                  type="text"
                  value={polyUSKeyId}
                  onChange={(e) => setPolyUSKeyId(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="e.g. 71836b68-e570-42d4-b0fa-ab241c2e545a"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5 text-text-secondary">
                  Secret Key
                </label>
                <input
                  type="password"
                  value={polyUSSecret}
                  onChange={(e) => setPolyUSSecret(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="Base64-encoded Ed25519 secret key"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => handleSave("polymarket_us")}
                  disabled={isPending}
                  className="rounded-lg border border-neon-green/30 bg-neon-green/10 px-4 py-2.5 text-sm font-mono font-medium text-neon-green transition-all hover:bg-neon-green/20 hover:shadow-[0_0_12px_rgba(0,255,170,0.1)] disabled:opacity-50"
                >
                  {isPending ? "Validating & Saving..." : "Save & Validate"}
                </button>
                {editing === "polymarket_us" && (
                  <button
                    onClick={() => setEditing(null)}
                    className="text-xs text-text-secondary hover:text-text-primary transition-colors px-3"
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
  );
}
