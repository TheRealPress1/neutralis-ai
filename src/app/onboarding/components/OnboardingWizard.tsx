"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { saveApiKeys } from "@/app/actions/api-keys";
import { completeOnboarding } from "@/app/actions/auth";

const INPUT_CLASS =
  "w-full rounded-lg bg-bg-elevated border border-border px-4 py-3 text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-text-primary/20 focus:border-text-primary/40 transition-colors";

const FEATURES = [
  {
    title: "Cross-platform scanning",
    description:
      "Monitors Kalshi and Polymarket US in real-time for pricing discrepancies across matched markets.",
  },
  {
    title: "Risk-managed evaluation",
    description:
      "Every opportunity is scored against configurable risk parameters before a trade is considered.",
  },
  {
    title: "Automated execution",
    description:
      "Executes hedged trades across both exchanges with position sizing, stop-losses, and take-profits.",
  },
];

export default function OnboardingWizard({
  firstName,
}: {
  firstName?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Kalshi
  const [kalshiKeyId, setKalshiKeyId] = useState("");
  const [kalshiPem, setKalshiPem] = useState("");

  // Polymarket US
  const [polyUSKeyId, setPolyUSKeyId] = useState("");
  const [polyUSSecret, setPolyUSSecret] = useState("");

  function handleSkip() {
    startTransition(async () => {
      await completeOnboarding();
      router.push("/dashboard");
    });
  }

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

    if (polyUSKeyId || polyUSSecret) {
      if (!polyUSKeyId || !polyUSSecret) {
        setError(
          "Polymarket US requires both a Key ID and a Secret Key.",
        );
        return;
      }
      keys.push({
        platform: "polymarket_us",
        api_key_id: polyUSKeyId.trim(),
        api_secret: polyUSSecret.trim(),
        private_key_pem: "",
      });
    }

    startTransition(async () => {
      if (keys.length > 0) {
        const result = await saveApiKeys(keys);
        if (result.error) {
          setError(result.error);
          return;
        }
      }
      await completeOnboarding();
      router.push("/dashboard");
    });
  }

  /* ── Step indicator ─────────────────────────────────────────────── */

  const stepIndicator = (
    <div className="flex items-center justify-center gap-2 mb-10">
      <span
        className={`h-2 w-2 rounded-full transition-colors ${
          step >= 1 ? "bg-text-primary" : "bg-border"
        }`}
      />
      <span
        className={`h-2 w-2 rounded-full transition-colors ${
          step >= 2 ? "bg-text-primary" : "bg-border"
        }`}
      />
    </div>
  );

  /* ── Step 1: Welcome ────────────────────────────────────────────── */

  if (step === 1) {
    return (
      <div>
        {stepIndicator}
        <div className="text-center mb-10">
          <h1 className="font-[family-name:var(--font-italiana)] text-3xl font-normal tracking-[0.06em]">
            {firstName ? `Welcome, ${firstName}` : "Welcome to Neutralis"}
          </h1>
          <p className="mt-3 text-text-secondary">
            Here&apos;s what the platform does for you.
          </p>
        </div>

        <div className="space-y-4 mb-10">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="hud-panel rounded-xl px-5 py-4 flex items-start gap-4"
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-bg-elevated text-xs font-medium text-text-secondary">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {f.title}
                </p>
                <p className="mt-0.5 text-xs text-text-secondary">
                  {f.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-text-secondary mb-8">
          To get started, connect your exchange API keys.
          <br />
          You can always do this later from the Connections tab.
        </p>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleSkip}
            disabled={isPending}
            className="rounded-full border border-border px-6 py-3 text-sm text-text-secondary hover:text-text-primary hover:border-text-primary/40 transition-colors disabled:opacity-50"
          >
            {isPending ? "Redirecting..." : "Skip for now"}
          </button>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="btn-sheen btn-pill bg-text-primary px-6 py-3 font-medium text-bg-primary transition-colors hover:bg-text-mono"
          >
            Get started
          </button>
        </div>
      </div>
    );
  }

  /* ── Step 2: Connect Keys ───────────────────────────────────────── */

  return (
    <div>
      {stepIndicator}
      <div className="text-center mb-8">
        <h1 className="font-[family-name:var(--font-italiana)] text-3xl font-normal tracking-[0.06em]">
          Connect your accounts
        </h1>
        <p className="mt-3 text-text-secondary">
          Link your exchange API keys so Neutralis can monitor and execute
          trades.
        </p>
      </div>

      <div className="space-y-8">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Kalshi */}
        <div className="hud-panel rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-1">Kalshi</h2>
          <p className="text-sm text-text-secondary mb-5">
            Generate an API key at{" "}
            <a
              href="https://kalshi.com/account/api"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-primary underline underline-offset-2 hover:text-white"
            >
              kalshi.com/account/api
            </a>
          </p>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="kalshi-key-id"
                className="block text-sm font-medium mb-2 text-text-primary"
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
                className="block text-sm font-medium mb-2 text-text-primary"
              >
                RSA Private Key (PEM)
              </label>
              <textarea
                id="kalshi-pem"
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
                className="mt-2 text-xs text-text-secondary hover:text-text-primary transition-colors underline underline-offset-2"
              >
                or upload a .pem file
              </button>
            </div>
          </div>
        </div>

        {/* Polymarket US */}
        <div className="hud-panel rounded-xl p-6">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-semibold">Polymarket US</h2>
            <span className="text-[10px] font-normal text-text-secondary">CFTC</span>
          </div>
          <p className="text-sm text-text-secondary mb-5">
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

          <div className="space-y-4">
            <div>
              <label
                htmlFor="poly-us-key-id"
                className="block text-sm font-medium mb-2 text-text-primary"
              >
                Key ID
              </label>
              <input
                id="poly-us-key-id"
                type="text"
                value={polyUSKeyId}
                onChange={(e) => setPolyUSKeyId(e.target.value)}
                className={INPUT_CLASS}
                placeholder="e.g. 71836b68-e570-42d4-b0fa-ab241c2e545a"
              />
            </div>

            <div>
              <label
                htmlFor="poly-us-secret"
                className="block text-sm font-medium mb-2 text-text-primary"
              >
                Secret Key
              </label>
              <input
                id="poly-us-secret"
                type="password"
                value={polyUSSecret}
                onChange={(e) => setPolyUSSecret(e.target.value)}
                className={INPUT_CLASS}
                placeholder="Base64-encoded Ed25519 secret key"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleSkip}
              disabled={isPending}
              className="rounded-full border border-border px-6 py-3 text-sm text-text-secondary hover:text-text-primary hover:border-text-primary/40 transition-colors disabled:opacity-50"
            >
              {isPending ? "Redirecting..." : "Skip for now"}
            </button>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="btn-sheen btn-pill bg-text-primary px-6 py-3 font-medium text-bg-primary transition-colors hover:bg-text-mono disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "Saving..." : "Save & continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
