"use client";

type NavTab =
  | "dashboard"
  | "automation"
  | "activity"
  | "matches"
  | "connections"
  | "settings";

export default function SetupBanner({
  onNavigate,
}: {
  onNavigate: (tab: NavTab) => void;
}) {
  return (
    <div className="rounded-xl border border-[#22262d] bg-[#0e1117] px-5 py-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#eceef0]">
          Connect your exchange accounts to get started
        </p>
        <p className="text-xs text-[#9ca3af] mt-0.5">
          Add your Kalshi and Polymarket API keys to enable live data and
          automated trading.
        </p>
      </div>
      <button
        onClick={() => onNavigate("connections")}
        className="shrink-0 rounded-lg bg-[#e8e9ea] px-4 py-2 text-xs font-medium text-[#050608] hover:bg-[#c0c5cb] transition-colors"
      >
        Connect now
      </button>
    </div>
  );
}
