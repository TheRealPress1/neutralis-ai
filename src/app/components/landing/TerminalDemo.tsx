"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import styles from "./TerminalDemo.module.css";

interface LogLine {
  time: string;
  level: "info" | "signal" | "guard" | "result";
  module: string;
  message: string;
}

const DEMO_LINES: LogLine[] = [
  { time: "14:22:31.001", level: "info", module: "ENGINE", message: "Loading sample market snapshots…" },
  { time: "14:22:31.024", level: "info", module: "MATCH", message: "Paired equivalent YES / NO outcomes" },
  { time: "14:22:31.041", level: "info", module: "QUOTE", message: "Kalshi YES         $0.62" },
  { time: "14:22:31.041", level: "info", module: "QUOTE", message: "Polymarket NO      $0.34" },
  { time: "14:22:31.042", level: "signal", module: "SIGNAL", message: "Combined cost      $0.96 / pair" },
  { time: "14:22:31.042", level: "signal", module: "EDGE", message: "$1.00 − $0.96 = $0.04 before fees" },
  { time: "14:22:31.063", level: "guard", module: "CHECK", message: "✓ Resolution criteria aligned [sample]" },
  { time: "14:22:31.068", level: "guard", module: "CHECK", message: "✓ Quote freshness verified [sample]" },
  { time: "14:22:31.074", level: "guard", module: "CHECK", message: "✓ Available liquidity checked [sample]" },
  { time: "14:22:31.081", level: "info", module: "REVIEW", message: "Fees & execution costs require review" },
  { time: "14:22:31.092", level: "result", module: "READY", message: "Sample signal prepared. No orders sent." },
];

const INITIAL_LINE_COUNT = 4;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(callback: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function getServerReducedMotionSnapshot() {
  return true;
}

function PlaybackIcon({ paused }: { paused: boolean }) {
  return paused ? (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M5 3.5a.5.5 0 0 1 .77-.42l7 4.5a.5.5 0 0 1 0 .84l-7 4.5A.5.5 0 0 1 5 12.5z" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="4" y="3" width="3" height="10" rx=".5" />
      <rect x="9" y="3" width="3" height="10" rx=".5" />
    </svg>
  );
}

export default function TerminalDemo() {
  const [lineCount, setLineCount] = useState(INITIAL_LINE_COUNT);
  const [hasEnteredView, setHasEnteredView] = useState(false);
  // A user can explicitly play a replay even when automatic motion is disabled.
  const [playbackOverride, setPlaybackOverride] = useState<boolean | null>(null);
  const reducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getServerReducedMotionSnapshot,
  );
  const sectionRef = useRef<HTMLElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const isComplete = lineCount === DEMO_LINES.length;
  const isPlaying = (playbackOverride ?? !reducedMotion) && !isComplete;

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasEnteredView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!hasEnteredView || !isPlaying) return;

    const timeout = window.setTimeout(() => {
      setLineCount((count) => Math.min(count + 1, DEMO_LINES.length));
    }, 1100);
    return () => window.clearTimeout(timeout);
  }, [hasEnteredView, isPlaying, lineCount]);

  useEffect(() => {
    const output = outputRef.current;
    if (output) output.scrollTop = output.scrollHeight;
  }, [lineCount]);

  function replay() {
    setLineCount(INITIAL_LINE_COUNT);
    setPlaybackOverride(true);
  }

  return (
    <section ref={sectionRef} id="engine" className={styles.section} aria-labelledby="engine-heading">
      <div className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}><span /> UNDER THE HOOD</p>
          <h2 id="engine-heading">From market noise<br />to a clear signal.</h2>
          <p className={styles.description}>
            The edge is in the details. Follow a signal from the first price
            mismatch to a decision you can inspect.
          </p>
          <ol className={styles.steps}>
            <li>
              <span className={styles.stepNumber}>01</span>
              <div><h3>Find the same outcome.</h3><p>Match markets across Kalshi and Polymarket.</p></div>
            </li>
            <li>
              <span className={styles.stepNumber}>02</span>
              <div><h3>Check every assumption.</h3><p>Inspect pricing, liquidity, and resolution rules.</p></div>
            </li>
            <li>
              <span className={styles.stepNumber}>03</span>
              <div><h3>Make an informed move.</h3><p>See the spread, the costs, and the full context.</p></div>
            </li>
          </ol>
        </div>

        <div className={styles.demo}>
          <div className={styles.terminal}>
            <div className={styles.titlebar}>
              <span className={styles.terminalTitle}>
                <svg viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="m3 5 4 4-4 4m6 0h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                neutralis / engine
              </span>
              <span className={styles.demoBadge}>DEMO REPLAY</span>
            </div>
            <div className={styles.sessionbar}>
              <span>SESSION <span className={styles.sessionId}>NTRL-001</span></span>
              <span className={styles.sessionStatus}><span /> SANDBOX</span>
            </div>
            <div ref={outputRef} className={styles.output} role="region" aria-label="Simulated engine replay transcript" tabIndex={0}>
              {DEMO_LINES.slice(0, lineCount).map((line, index) => (
                <div className={`${styles.line} ${styles[line.level]}`} key={index}>
                  <span className={styles.timestamp}>{line.time}</span>
                  <span className={styles.module}>{line.module}</span>
                  <span className={styles.message}>{line.message}</span>
                </div>
              ))}
              <div className={styles.cursorRow} aria-hidden="true"><span className={isPlaying ? styles.activeCursor : styles.cursor} /></div>
            </div>
            <div className={styles.controls}>
              <span className={styles.playbackStatus}>
                <span className={isComplete ? styles.completeDot : styles.statusDot} />
                {isComplete ? "Replay complete" : isPlaying ? "Replaying sample events" : "Replay paused"}
              </span>
              <div className={styles.buttons}>
                <button type="button" onClick={() => setPlaybackOverride(!isPlaying)} disabled={isComplete} aria-label={isPlaying ? "Pause engine replay" : "Resume engine replay"}>
                  <PlaybackIcon paused={!isPlaying} />
                  {isPlaying ? "Pause" : "Resume"}
                </button>
                <button type="button" onClick={replay} aria-label="Restart engine replay">
                  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 5.5a5 5 0 1 1-.3 4M3.5 2v3.5H7" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Replay
                </button>
              </div>
            </div>
          </div>
          <p className={styles.caption}>Illustrative sample data. Gross spread is before fees and execution costs.</p>
        </div>
      </div>
    </section>
  );
}
