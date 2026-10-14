"use client";

import { useId, useState } from "react";
import type { MarketHistoryPoint } from "@/lib/terminal/market-types";
import styles from "./TerminalWorkspace.module.css";

export default function MarketChart({ points, status, now }: { points: MarketHistoryPoint[]; status: string; now: number }) {
  const [range, setRange] = useState<"1D" | "1W">("1W");
  const [hover, setHover] = useState<number | null>(null);
  const gradient = useId();
  const visible = points.filter((point) => point.time * 1000 >= now - (range === "1D" ? 86_400_000 : 604_800_000));
  const low = Math.max(0, Math.floor((Math.min(...visible.map((p) => p.price), 1) - .02) * 10) / 10);
  const high = Math.min(1, Math.ceil((Math.max(...visible.map((p) => p.price), 0) + .02) * 10) / 10);
  const start = visible[0]?.time ?? 0;
  const end = visible.at(-1)?.time ?? 1;
  const x = (point: MarketHistoryPoint) => 12 + ((point.time - start) / Math.max(1, end - start)) * 646;
  const y = (point: MarketHistoryPoint) => 18 + (1 - (point.price - low) / Math.max(.1, high - low)) * 166;
  const path = visible.map((point, index) => `${index ? "L" : "M"}${x(point).toFixed(2)},${y(point).toFixed(2)}`).join(" ");
  const active = hover === null ? null : visible[hover];
  const labelTime = (seconds: number) => new Date(seconds * 1000).toLocaleString("en-US", { month: "short", day: "numeric", ...(range === "1D" ? { hour: "numeric" as const } : {}) });
  return <section className={styles.chart} aria-label="YES price history">
    <div className={styles.sectionHeading}><span>YES PRICE <span className={styles.subtle}>/ HOURLY TRADES</span></span><div className={styles.segmented}>{(["1D", "1W"] as const).map((value) => <button key={value} aria-pressed={range === value} onClick={() => {setRange(value); setHover(null);}}>{value}</button>)}</div></div>
    {visible.length > 1 ? <>
      <div className={styles.chartReadout}>{active ? <><strong>{(active.price * 100).toFixed(1)}¢</strong><span>{new Date(active.time * 1000).toLocaleString()}</span></> : <span>Actual trades · {visible.length} hourly observations{status === "stale" ? " · Chart delayed" : ""}</span>}</div>
      <svg viewBox="0 0 720 208" role="img" aria-label={`YES trade price from ${(visible[0].price * 100).toFixed(1)} to ${(visible.at(-1)!.price * 100).toFixed(1)} cents over ${range === "1D" ? "one day" : "one week"}`} onPointerMove={(event) => { const rect = event.currentTarget.getBoundingClientRect(); const target = start + (((event.clientX - rect.left) / rect.width * 720 - 12) / 646) * (end - start); let nearest = 0; for (let i = 1; i < visible.length; i++) if (Math.abs(visible[i].time - target) < Math.abs(visible[nearest].time - target)) nearest = i; setHover(nearest); }} onPointerLeave={() => setHover(null)}>
        <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f18b4c" stopOpacity=".18"/><stop offset="100%" stopColor="#f18b4c" stopOpacity="0"/></linearGradient></defs>
        {[0, 1, 2, 3].map((tick) => <g key={tick}><line x1="12" x2="658" y1={18 + tick * 166 / 3} y2={18 + tick * 166 / 3} stroke="#2b302a" strokeDasharray="3 5"/><text x="675" y={22 + tick * 166 / 3} fill="#858d80" fontSize="10" fontFamily="monospace">{Math.round((high - tick * (high - low) / 3) * 100)}¢</text></g>)}
        <path d={`${path} L${x(visible.at(-1)!)},190 L12,190 Z`} fill={`url(#${gradient})`}/><path d={path} fill="none" stroke="#f1a16b" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round"/>
        {active && <g><line x1={x(active)} x2={x(active)} y1="8" y2="190" stroke="#878e80" strokeDasharray="3 3"/><circle cx={x(active)} cy={y(active)} r="4" fill="#f1a16b" stroke="#171b15" strokeWidth="2"/></g>}
      </svg><div className={styles.chartDates}><span>{labelTime(start)}</span><span>{labelTime(end)}</span></div>
    </> : <div className={styles.chartEmpty}><span>↗</span><p>{status === "loading" ? "Loading price history…" : status === "unavailable" ? "Price history is temporarily unavailable." : "Not enough trades in this period to draw a chart."}</p><small>Live quotes are shown above when available.</small></div>}
  </section>;
}
