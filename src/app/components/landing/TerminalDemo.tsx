"use client";

import { useEffect, useRef, useState } from "react";

interface LogLine {
  time: string;
  level: "info" | "signal" | "guard" | "order" | "warn";
  module: string;
  message: string;
}

const DEMO_LINES: LogLine[] = [
  { time: "14:22:31", level: "info",   module: "engine",    message: "WebSocket connected to Kalshi (1,847 markets)" },
  { time: "14:22:31", level: "info",   module: "engine",    message: "WebSocket connected to Polymarket US (871 markets)" },
  { time: "14:22:32", level: "info",   module: "matcher",   message: "Matched 847 cross-platform pairs (TF-IDF threshold 0.75)" },
  { time: "14:22:35", level: "signal", module: "scanner",   message: "RT arb: KXEPLGAME-CRYNEW K=0.38 P=0.62 edge=24.1%" },
  { time: "14:22:35", level: "guard",  module: "decision",  message: "Signal ec32d91b: 11/11 guards passed, size=$46.45" },
  { time: "14:22:35", level: "order",  module: "execution", message: "Order filled: CRYNEW buy YES on kalshi @ $0.38 (12 contracts)" },
  { time: "14:22:35", level: "order",  module: "execution", message: "Order filled: CRYNEW buy NO on poly_us @ $0.38 (hedge)" },
  { time: "14:22:36", level: "info",   module: "portfolio", message: "Position opened: edge=24.1%, exposure=$46.45, P&L target=$11.20" },
  { time: "14:22:48", level: "signal", module: "scanner",   message: "RT arb: KXSERIEAGAME-NAPACM K=0.40 P=0.61 edge=25.5%" },
  { time: "14:22:48", level: "guard",  module: "decision",  message: "Signal a55fdf76: 11/11 guards passed, size=$43.80" },
  { time: "14:22:48", level: "warn",   module: "guard",     message: "Ticker exposure cap reached — clamping size to $38.20" },
  { time: "14:22:49", level: "order",  module: "execution", message: "Order filled: NAPACM buy YES on kalshi @ $0.40 (9 contracts)" },
  { time: "14:22:49", level: "order",  module: "execution", message: "Order filled: NAPACM buy NO on poly_us @ $0.39 (hedge)" },
  { time: "14:22:50", level: "info",   module: "portfolio", message: "2 open positions, $84.65 exposure, $0.00 unrealized P&L" },
  { time: "14:23:01", level: "signal", module: "scanner",   message: "Complement arb: KXATPMATCH-YUNSCH YES+NO=$0.94 (6% edge)" },
  { time: "14:23:01", level: "guard",  module: "decision",  message: "Signal rejected: confidence 42 < regime minimum 55" },
  { time: "14:23:15", level: "info",   module: "settler",   message: "Settlement check: 2 positions checked, none resolved" },
  { time: "14:23:30", level: "info",   module: "mtm",       message: "Marked 2 positions to market: unrealized P&L +$2.30" },
];

const LEVEL_COLORS: Record<string, { dot: string; text: string }> = {
  info:   { dot: "bg-text-secondary",  text: "text-text-secondary" },
  signal: { dot: "bg-neon-blue",       text: "text-neon-blue" },
  guard:  { dot: "bg-neon-purple",     text: "text-neon-purple" },
  order:  { dot: "bg-neon-green",      text: "text-neon-green" },
  warn:   { dot: "bg-neon-amber",      text: "text-neon-amber" },
};

export default function TerminalDemo() {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [started, setStarted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  // Start animation when scrolled into view
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          setStarted(true);
        }
      },
      { threshold: 0.2 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [started]);

  // Type out lines one by one
  useEffect(() => {
    if (!started) return;

    let i = 0;
    const interval = setInterval(() => {
      if (i >= DEMO_LINES.length) {
        // Loop: restart after pause
        setTimeout(() => {
          setLines([]);
          i = 0;
        }, 3000);
        return;
      }
      setLines((prev) => [...prev, DEMO_LINES[i]]);
      i++;
    }, 600);

    return () => clearInterval(interval);
  }, [started]);

  // Auto-scroll to bottom
  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <section ref={sectionRef} className="border-t border-border py-24">
      <div className="mx-auto max-w-4xl px-6">
        <p className="text-center font-mono text-[10px] font-medium uppercase tracking-[0.3em] text-text-secondary">
          Live Pipeline Output
        </p>
        <h2 className="mt-3 text-center font-[family-name:var(--font-italiana)] text-3xl font-normal uppercase tracking-[0.08em] text-text-primary">
          See it in action
        </h2>

        {/* Terminal window */}
        <div className="mt-12 overflow-hidden rounded-xl border border-border">
          {/* Title bar */}
          <div className="flex items-center gap-2 border-b border-border bg-bg-secondary px-4 py-2.5">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-neon-red/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-neon-amber/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-neon-green/60" />
            </div>
            <span className="ml-2 font-mono text-[10px] tracking-wider text-text-secondary">
              neutralis-daemon — event_engine.py
            </span>
            <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-neon-green/80">
              <span className="h-1.5 w-1.5 rounded-full bg-neon-green neon-pulse" />
              LIVE
            </span>
          </div>

          {/* Log output */}
          <div
            ref={containerRef}
            className="h-[420px] overflow-y-auto bg-[#040508] p-4 font-mono text-xs leading-relaxed"
          >
            {lines.length === 0 && started && (
              <div className="flex items-center gap-2 text-text-secondary">
                <span className="inline-block h-3 w-1 animate-pulse bg-neon-green/60" />
                Connecting to engine...
              </div>
            )}

            {lines.map((line, i) => {
              const lc = LEVEL_COLORS[line.level];
              return (
                <div
                  key={i}
                  className="flex gap-3 py-0.5"
                  style={{
                    animation: "line-in 0.3s ease-out",
                  }}
                >
                  <span className="shrink-0 text-text-secondary/50">{line.time}</span>
                  <span className={`shrink-0 flex items-center gap-1.5 ${lc.text}`}>
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${lc.dot}`} />
                    <span className="w-[52px] text-right uppercase">{line.level}</span>
                  </span>
                  <span className="shrink-0 w-[72px] text-right text-text-secondary/60">{line.module}</span>
                  <span className="text-text-mono">{line.message}</span>
                </div>
              );
            })}

            {/* Blinking cursor at bottom */}
            {lines.length > 0 && (
              <div className="mt-1 flex items-center gap-2 text-text-secondary">
                <span className="inline-block h-3 w-1 animate-pulse bg-neon-green/60" />
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes line-in {
          from {
            opacity: 0;
            transform: translateX(-8px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </section>
  );
}
