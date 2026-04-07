"use client";

import { useEffect, useRef } from "react";

/**
 * Animated mesh gradient background using CSS — organic flowing blobs
 * that shift position and color over time. Lightweight alternative to WebGL.
 */
export default function MeshGradient() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Primary blob — neon green */}
      <div
        className="absolute h-[80vh] w-[80vw] rounded-full opacity-[0.07]"
        style={{
          background: "radial-gradient(circle, #00ffaa 0%, transparent 70%)",
          top: "20%",
          left: "30%",
          animation: "mesh-drift-1 20s ease-in-out infinite",
          filter: "blur(80px)",
        }}
      />
      {/* Secondary blob — neon blue */}
      <div
        className="absolute h-[60vh] w-[70vw] rounded-full opacity-[0.05]"
        style={{
          background: "radial-gradient(circle, #00d4ff 0%, transparent 70%)",
          top: "40%",
          left: "50%",
          animation: "mesh-drift-2 25s ease-in-out infinite",
          filter: "blur(100px)",
        }}
      />
      {/* Tertiary blob — purple */}
      <div
        className="absolute h-[50vh] w-[60vw] rounded-full opacity-[0.04]"
        style={{
          background: "radial-gradient(circle, #a855f7 0%, transparent 70%)",
          top: "60%",
          left: "20%",
          animation: "mesh-drift-3 18s ease-in-out infinite",
          filter: "blur(90px)",
        }}
      />

      <style jsx>{`
        @keyframes mesh-drift-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-10%, 8%) scale(1.1); }
          66% { transform: translate(8%, -5%) scale(0.95); }
        }
        @keyframes mesh-drift-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(12%, -10%) scale(1.05); }
          66% { transform: translate(-8%, 6%) scale(0.9); }
        }
        @keyframes mesh-drift-3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-6%, -8%) scale(1.15); }
          66% { transform: translate(10%, 10%) scale(0.85); }
        }
      `}</style>
    </div>
  );
}
