"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { saveApiKeys } from "@/app/actions/api-keys";

const INPUT_CLASS =
  "w-full rounded-lg bg-[#1a1d21] border border-[#2a2d31] px-4 py-3 text-[#e8e9ea] placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#e8e9ea]/20 focus:border-[#e8e9ea]/40 transition-colors";

export default function OnboardingForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Kalshi
  const [kalshiKeyId, setKalshiKeyId] = useState("");
  const [kalshiPem, setKalshiPem] = useState("");

  // Polymarket
  const [polyKey, setPolyKey] = useState("");
  const [polySecret, setPolySecret] = useState("");

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setKalshiPem(text);
  }

  function handleSave() {
    setError(null);

    const keys: Parameters<typeof saveApiKeys>[0] = [];

    if (kalshiKeyId || kalshiPem) {
      if (!kalshiKeyId || !kalshiPem) {
        setError("Kalshi requires both an API Key ID and a Private Key.");
        return;
      }
      keys.push({
        platform: "kalshi",
        api_key_id: kalshiKeyId.trim(),
        api_secret: "",
        private_key_pem: kalshiPem.trim(),
      });
    }

    if (polyKey || polySecret) {
      if (!polyKey || !polySecret) {
        setError("Polymarket requires both an API Key and an API Secret.");
        return;
      }
      keys.push({
        platform: "polymarket",
        api_key_id: polyKey.trim(),
        api_secret: polySecret.trim(),
        private_key_pem: "",
      });
    }

    if (keys.length === 0) {
      router.push("/dashboard");
      return;
    }

    startTransition(async () => {
      const result = await saveApiKeys(keys);
      if (result.error) {
        setError(result.error);
      } else {
        router.push("/dashboard");
      }
    });
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Kalshi */}
      <div className="card-panel card-accent rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-1">Kalshi</h2>
        <p className="text-sm text-[#9ca3af] mb-5">
          Enter your Kalshi API Key ID and RSA Private Key.
        </p>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="kalshi-key-id"
              className="block text-sm font-medium mb-2 text-[#e8e9ea]"
            >
              API Key ID
            </label>
            <input
              id="kalshi-key-id"
              type="text"
              value={kalshiKeyId}
              onChange={(e) => setKalshiKeyId(e.target.value)}
              className={INPUT_CLASS}
              placeholder="e.g. 6cd6375f-c6a7-440a-9f6f-c41c3bc68ff0"
            />
          </div>

          <div>
            <label
              htmlFor="kalshi-pem"
              className="block text-sm font-medium mb-2 text-[#e8e9ea]"
            >
              RSA Private Key (PEM)
            </label>
            <textarea
              id="kalshi-pem"
              value={kalshiPem}
              onChange={(e) => setKalshiPem(e.target.value)}
              rows={6}
              className={`${INPUT_CLASS} font-mono text-xs`}
              placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
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
              className="mt-2 text-xs text-[#9ca3af] hover:text-[#e8e9ea] transition-colors underline underline-offset-2"
            >
              or upload a .pem file
            </button>
          </div>
        </div>
      </div>

      {/* Polymarket */}
      <div className="card-panel card-accent rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-1">Polymarket</h2>
        <p className="text-sm text-[#9ca3af] mb-5">
          Enter your Polymarket CLOB API credentials.
        </p>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="poly-key"
              className="block text-sm font-medium mb-2 text-[#e8e9ea]"
            >
              API Key
            </label>
            <input
              id="poly-key"
              type="text"
              value={polyKey}
              onChange={(e) => setPolyKey(e.target.value)}
              className={INPUT_CLASS}
              placeholder="Your Polymarket API key"
            />
          </div>

          <div>
            <label
              htmlFor="poly-secret"
              className="block text-sm font-medium mb-2 text-[#e8e9ea]"
            >
              API Secret
            </label>
            <input
              id="poly-secret"
              type="password"
              value={polySecret}
              onChange={(e) => setPolySecret(e.target.value)}
              className={INPUT_CLASS}
              placeholder="Your Polymarket API secret"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="rounded-full border border-[#2a2d31] px-6 py-3 text-sm text-[#9ca3af] hover:text-[#e8e9ea] hover:border-[#e8e9ea]/40 transition-colors"
        >
          Skip for now
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="btn-sheen btn-pill bg-[#e8e9ea] px-6 py-3 font-medium text-[#050608] transition-colors hover:bg-[#c0c5cb] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Saving..." : "Save & continue"}
        </button>
      </div>
    </div>
  );
}
