"use client";

type NavTab =
  | "dashboard"
  | "live"
  | "activity"
  | "markets"
  | "connections"
  | "settings";

export default function SetupBanner({
  onNavigate,
}: {
  onNavigate: (tab: NavTab) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-secondary px-5 py-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-primary">
          Connect your exchange accounts to get started
        </p>
        <p className="text-xs text-text-secondary mt-0.5">
          Add your Kalshi and Polymarket API keys to enable live data and
          automated trading.
        </p>
      </div>
      <button
        onClick={() => onNavigate("connections")}
        className="shrink-0 rounded-lg bg-text-primary px-4 py-2 text-xs font-medium text-bg-primary hover:bg-text-mono transition-colors"
      >
        Connect now
      </button>
    </div>
  );
}
