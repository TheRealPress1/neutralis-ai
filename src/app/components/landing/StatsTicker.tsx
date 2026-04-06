"use client";

import { useEffect, useRef, useState } from "react";

interface StatItem {
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
}

const STATS: StatItem[] = [
  { label: "Markets Scanned", value: 3200, suffix: "+" },
  { label: "Pairs Matched", value: 847 },
  { label: "Signals Today", value: 264 },
  { label: "Avg Edge", value: 12.4, suffix: "%", decimals: 1 },
  { label: "Latency", value: 180, suffix: "ms", prefix: "<" },
  { label: "Uptime", value: 99.9, suffix: "%", decimals: 1 },
];

function AnimatedNumber({
  target,
  decimals = 0,
  prefix = "",
  suffix = "",
}: {
  target: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}) {
  const [current, setCurrent] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const duration = 1800;
          const start = performance.now();

          function tick(now: number) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setCurrent(eased * target);
            if (progress < 1) requestAnimationFrame(tick);
          }

          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  const display = decimals > 0 ? current.toFixed(decimals) : Math.floor(current).toLocaleString();

  return (
    <span ref={ref} className="font-mono text-3xl font-bold tabular-nums text-text-primary sm:text-4xl">
      {prefix}{display}{suffix}
    </span>
  );
}

export default function StatsTicker() {
  return (
    <section className="relative border-y border-border bg-bg-secondary/50 py-16 overflow-hidden">
      {/* Subtle horizontal scan line */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-green/10 to-transparent"
          style={{ animation: "scanline 6s linear infinite" }}
        />
      </div>

      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-6">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <AnimatedNumber
                target={stat.value}
                decimals={stat.decimals}
                prefix={stat.prefix}
                suffix={stat.suffix}
              />
              <p className="mt-2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-text-secondary">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
