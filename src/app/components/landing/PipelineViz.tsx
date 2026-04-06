"use client";

import { useEffect, useRef, useState } from "react";

const STAGES = [
  {
    id: "scan",
    label: "SCAN",
    detail: "3,200+ markets",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    ),
    color: "neon-blue",
  },
  {
    id: "match",
    label: "MATCH",
    detail: "TF-IDF pairing",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
      </svg>
    ),
    color: "neon-purple",
  },
  {
    id: "score",
    label: "SCORE",
    detail: "Edge + confidence",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
        <path d="M3 3v18h18" />
        <path d="m7 16 4-8 4 4 4-8" />
      </svg>
    ),
    color: "neon-amber",
  },
  {
    id: "guard",
    label: "GUARD",
    detail: "11 risk checks",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    color: "neon-green",
  },
  {
    id: "execute",
    label: "EXECUTE",
    detail: "<200ms",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
    color: "neon-green",
  },
];

const COLOR_MAP: Record<string, { text: string; bg: string; border: string; glow: string; shadow: string }> = {
  "neon-blue":   { text: "text-neon-blue",   bg: "bg-neon-blue/10",   border: "border-neon-blue/30",   glow: "rgba(0,212,255,0.3)",   shadow: "rgba(0,212,255,0.15)" },
  "neon-purple": { text: "text-neon-purple", bg: "bg-neon-purple/10", border: "border-neon-purple/30", glow: "rgba(168,85,247,0.3)", shadow: "rgba(168,85,247,0.15)" },
  "neon-amber":  { text: "text-neon-amber",  bg: "bg-neon-amber/10",  border: "border-neon-amber/30",  glow: "rgba(255,170,0,0.3)",  shadow: "rgba(255,170,0,0.15)" },
  "neon-green":  { text: "text-neon-green",  bg: "bg-neon-green/10",  border: "border-neon-green/30",  glow: "rgba(0,255,170,0.3)",  shadow: "rgba(0,255,170,0.15)" },
};

function Connector({ active }: { active: boolean }) {
  return (
    <div className="relative hidden items-center lg:flex lg:flex-1">
      <div className={`h-px w-full transition-colors duration-700 ${active ? "bg-neon-green/30" : "bg-border"}`} />
      {active && (
        <div
          className="absolute h-1.5 w-8 rounded-full bg-neon-green/60"
          style={{
            animation: "flow-dot 2s ease-in-out infinite",
            filter: "blur(2px)",
          }}
        />
      )}
    </div>
  );
}

export default function PipelineViz() {
  const [activeStage, setActiveStage] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let running = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !running) {
          running = true;
          // Animate stages sequentially
          STAGES.forEach((_, i) => {
            setTimeout(() => setActiveStage(i), i * 400);
          });
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="relative border-t border-border py-24 overflow-hidden">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-center font-mono text-[10px] font-medium uppercase tracking-[0.3em] text-text-secondary">
          Pipeline Architecture
        </p>
        <h2 className="mt-3 text-center font-[family-name:var(--font-italiana)] text-3xl font-normal uppercase tracking-[0.08em] text-text-primary">
          Every signal, verified
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-center text-sm text-text-secondary">
          From market scan to order execution in under 200ms. Every trade passes through 11 independent risk guards before a single dollar moves.
        </p>

        {/* Pipeline flow */}
        <div className="mt-16 flex flex-col items-stretch gap-4 lg:flex-row lg:items-center lg:gap-0">
          {STAGES.map((stage, i) => {
            const c = COLOR_MAP[stage.color];
            const isActive = i <= activeStage;
            return (
              <div key={stage.id} className="contents">
                {/* Stage card */}
                <div
                  className={`group relative flex flex-1 flex-col items-center rounded-xl border p-6 transition-all duration-500 ${
                    isActive
                      ? `${c.border} ${c.bg}`
                      : "border-border bg-bg-secondary"
                  }`}
                  style={isActive ? { boxShadow: `0 0 30px ${c.shadow}` } : undefined}
                >
                  {/* Corner ticks */}
                  <div
                    className={`absolute top-0 left-0 h-2 w-2 border-l border-t transition-colors duration-500 ${
                      isActive ? c.border : "border-border"
                    }`}
                  />
                  <div
                    className={`absolute bottom-0 right-0 h-2 w-2 border-r border-b transition-colors duration-500 ${
                      isActive ? c.border : "border-border"
                    }`}
                  />

                  <div className={`transition-colors duration-500 ${isActive ? c.text : "text-text-secondary"}`}>
                    {stage.icon}
                  </div>
                  <span
                    className={`mt-3 font-mono text-[11px] font-bold uppercase tracking-[0.2em] transition-colors duration-500 ${
                      isActive ? c.text : "text-text-secondary"
                    }`}
                  >
                    {stage.label}
                  </span>
                  <span className="mt-1 text-[11px] text-text-secondary">
                    {stage.detail}
                  </span>
                </div>

                {/* Connector between stages */}
                {i < STAGES.length - 1 && <Connector active={i < activeStage} />}
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        @keyframes flow-dot {
          0% { left: 0%; opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { left: calc(100% - 32px); opacity: 0; }
        }
      `}</style>
    </section>
  );
}
