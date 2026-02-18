"use client";

import { useState, useTransition } from "react";
import { generateAccessCode } from "@/app/actions/subscription";

export default function AccessCodeGenerator() {
  const [codes, setCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const result = await generateAccessCode();
      if (result.code) {
        setCodes((prev) => [result.code!, ...prev]);
      } else {
        setError(result.error ?? "Failed to generate code");
      }
    });
  }

  return (
    <div className="rounded-xl border border-[#22262d] bg-[#0e1117] p-6">
      <h3 className="text-sm font-medium text-[#eceef0] mb-1">
        Access Codes
      </h3>
      <p className="text-xs text-[#9ca3af] mb-4">
        Generate single-use codes to grant Pro access without a subscription.
      </p>

      <button
        onClick={handleGenerate}
        disabled={isPending}
        className="rounded-lg bg-[#e8e9ea] px-4 py-2 text-sm font-medium text-[#050608] transition-colors hover:bg-[#c0c5cb] disabled:opacity-50"
      >
        {isPending ? "Generating..." : "Generate Code"}
      </button>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {codes.length > 0 && (
        <div className="mt-4 space-y-2">
          {codes.map((c, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border border-[#22262d] bg-[#1a1d21] px-4 py-2.5"
            >
              <code className="flex-1 text-sm font-mono text-[#e8e9ea] tracking-wider">
                {c}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(c)}
                className="text-xs text-[#9ca3af] hover:text-[#e8e9ea] transition-colors"
              >
                Copy
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
