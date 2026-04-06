"use client";

import { useState, useTransition } from "react";
import { redeemAccessCode } from "@/app/actions/subscription";

export default function RedeemCode() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  function handleRedeem() {
    if (!code.trim()) return;
    setMessage(null);
    startTransition(async () => {
      const result = await redeemAccessCode(code);
      if (result.success) {
        setMessage({ text: "Code redeemed — you now have Pro access.", ok: true });
        setCode("");
      } else {
        setMessage({ text: result.error ?? "Something went wrong", ok: false });
      }
    });
  }

  return (
    <div className="mt-14 text-center">
      <p className="text-sm text-text-secondary mb-4">Have an access code?</p>
      <div className="mx-auto flex max-w-sm items-center gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
          placeholder="Enter code"
          className="flex-1 rounded-lg border border-border bg-bg-secondary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary outline-none transition-colors focus:border-text-mono"
        />
        <button
          onClick={handleRedeem}
          disabled={isPending || !code.trim()}
          className="rounded-lg border border-border bg-bg-elevated px-5 py-2.5 text-sm font-medium text-text-primary transition-colors hover:border-text-primary/30 hover:bg-border disabled:opacity-50"
        >
          {isPending ? "Redeeming..." : "Redeem"}
        </button>
      </div>
      {message && (
        <p
          className={`mt-3 text-sm ${message.ok ? "text-neon-green" : "text-red-400"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
