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
      <p className="text-sm text-[#9ca3af] mb-4">Have an access code?</p>
      <div className="mx-auto flex max-w-sm items-center gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
          placeholder="Enter code"
          className="flex-1 rounded-lg border border-[#22262d] bg-[#0e1117] px-3 py-2.5 text-sm text-[#e8e9ea] placeholder:text-[#555a63] outline-none transition-colors focus:border-[#c0c5cb]"
        />
        <button
          onClick={handleRedeem}
          disabled={isPending || !code.trim()}
          className="rounded-lg border border-[#22262d] bg-[#1a1d21] px-5 py-2.5 text-sm font-medium text-[#e8e9ea] transition-colors hover:border-[#e8e9ea]/30 hover:bg-[#22262d] disabled:opacity-50"
        >
          {isPending ? "Redeeming..." : "Redeem"}
        </button>
      </div>
      {message && (
        <p
          className={`mt-3 text-sm ${message.ok ? "text-emerald-400" : "text-red-400"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
