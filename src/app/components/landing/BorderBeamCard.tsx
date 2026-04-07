"use client";

import type { ReactNode } from "react";

/**
 * HUD panel with an animated light beam traveling around its border.
 * Pure CSS — no JS runtime cost.
 */
export default function BorderBeamCard({
  children,
  className = "",
  beamColor = "neon-green",
  duration = 6,
}: {
  children: ReactNode;
  className?: string;
  beamColor?: "neon-green" | "neon-blue" | "neon-purple";
  duration?: number;
}) {
  const colors = {
    "neon-green": { main: "#00ffaa", glow: "rgba(0,255,170,0.4)" },
    "neon-blue": { main: "#00d4ff", glow: "rgba(0,212,255,0.4)" },
    "neon-purple": { main: "#a855f7", glow: "rgba(168,85,247,0.4)" },
  };

  const c = colors[beamColor];

  return (
    <div className={`group relative overflow-hidden rounded-xl border border-border bg-bg-secondary ${className}`}>
      {/* Corner ticks */}
      <div className="absolute top-0 left-0 h-2.5 w-2.5 border-l border-t border-neon-green/25 rounded-tl-xl z-10 pointer-events-none" />
      <div className="absolute bottom-0 right-0 h-2.5 w-2.5 border-r border-b border-neon-green/25 rounded-br-xl z-10 pointer-events-none" />

      {/* Animated border beam */}
      <div
        className="absolute inset-0 rounded-xl pointer-events-none"
        style={{
          background: `conic-gradient(from var(--beam-angle, 0deg) at 50% 50%, transparent 0deg, transparent 340deg, ${c.main} 350deg, ${c.glow} 355deg, transparent 360deg)`,
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "exclude",
          WebkitMaskComposite: "xor",
          padding: "1px",
          animation: `beam-rotate ${duration}s linear infinite`,
        }}
      />

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>

      <style jsx>{`
        @keyframes beam-rotate {
          from { --beam-angle: 0deg; }
          to { --beam-angle: 360deg; }
        }
        @property --beam-angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }
      `}</style>
    </div>
  );
}
