"use client";

import { useEffect, useState, useTransition } from "react";
import {
  generateAccessCode,
  listAccessCodes,
  deleteAccessCode,
  type AccessCodeRow,
} from "@/app/actions/subscription";

export default function AccessCodeGenerator() {
  const [codes, setCodes] = useState<AccessCodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    listAccessCodes().then((res) => {
      if (res.codes) setCodes(res.codes);
      setLoading(false);
    });
  }, []);

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const result = await generateAccessCode();
      if (result.error) {
        setError(result.error);
        return;
      }
      // Refresh the full list to get the new code with metadata
      const res = await listAccessCodes();
      if (res.codes) setCodes(res.codes);
    });
  }

  function handleDelete(codeId: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteAccessCode(codeId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setCodes((prev) => prev.filter((c) => c.id !== codeId));
    });
  }

  function timeAgo(iso: string) {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  }

  return (
    <div className="hud-panel p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-medium text-text-primary">Access Codes</h3>
        <span className="text-xs text-text-secondary">
          {codes.filter((c) => !c.redeemed_at).length} available
          {" / "}
          {codes.filter((c) => c.redeemed_at).length} claimed
        </span>
      </div>
      <p className="text-xs text-text-secondary mb-4">
        Generate single-use codes to grant Pro access without a subscription.
      </p>

      <button
        onClick={handleGenerate}
        disabled={isPending}
        className="rounded-lg border border-neon-green/30 bg-neon-green/10 px-4 py-2 font-mono text-sm font-medium text-neon-green transition-all hover:bg-neon-green/20 hover:shadow-[0_0_12px_rgba(0,255,170,0.1)] disabled:opacity-50"
      >
        {isPending ? "Generating..." : "Generate Code"}
      </button>

      {error && <p className="mt-3 text-sm text-neon-red">{error}</p>}

      {loading ? (
        <div className="mt-4 space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-bg-elevated skeleton" />
          ))}
        </div>
      ) : codes.length > 0 ? (
        <div className="mt-4 space-y-2">
          {codes.map((c) => (
            <div
              key={c.id}
              className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 ${
                c.redeemed_at
                  ? "border-border/40 bg-bg-elevated/40"
                  : "border-border bg-bg-elevated"
              }`}
            >
              <code className="text-sm font-mono text-neon-green tracking-wider shrink-0">
                {c.code}
              </code>

              <div className="flex-1 min-w-0 text-right">
                {c.redeemed_at ? (
                  <span className="text-xs text-neon-green">
                    Claimed by{" "}
                    <span className="text-neon-green/80">{c.redeemed_by_email}</span>
                    <span className="text-text-secondary ml-1.5">
                      {timeAgo(c.redeemed_at)}
                    </span>
                  </span>
                ) : (
                  <span className="text-xs text-text-secondary">
                    Unclaimed &middot; {timeAgo(c.created_at)}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => navigator.clipboard.writeText(c.code)}
                  className="text-xs text-text-secondary hover:text-text-primary transition-colors"
                >
                  Copy
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  disabled={isPending}
                  className="text-xs text-neon-red/70 hover:text-neon-red transition-colors disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-xs text-text-secondary">
          No codes generated yet.
        </p>
      )}
    </div>
  );
}
