#!/usr/bin/env node
/** One-shot by default. Explicit --loop schedules bounded, non-overlapping runs. */
import { setTimeout as delay } from "node:timers/promises";

const base = process.env.TERMINAL_MONITOR_BASE_URL;
const secret = process.env.TERMINAL_MONITOR_WORKER_SECRET;
let url;
try {
  url = new URL(base ?? "");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error();
  if (!secret || secret.length < 32 || secret.length > 512 || /\s/.test(secret)) throw new Error();
} catch {
  process.stderr.write("Configure TERMINAL_MONITOR_BASE_URL as an HTTPS origin and TERMINAL_MONITOR_WORKER_SECRET as 32–512 non-whitespace characters.\n");
  process.exit(1);
}
const loop = process.argv.includes("--loop");
if (process.argv.slice(2).some((value) => value !== "--loop")) {
  process.stderr.write("Usage: node scripts/run-terminal-monitors.mjs [--loop]\n");
  process.exit(1);
}
const seconds = Number(process.env.TERMINAL_MONITOR_INTERVAL_SECONDS ?? "60");
if (!Number.isSafeInteger(seconds) || seconds < 60 || seconds > 3600) {
  process.stderr.write("TERMINAL_MONITOR_INTERVAL_SECONDS must be an integer from 60 to 3600.\n");
  process.exit(1);
}
const endpoint = new URL("/api/internal/terminal-monitors", url);
const stop = new AbortController();
process.on("SIGTERM", () => stop.abort());
process.on("SIGINT", () => stop.abort());
do {
  try {
    const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" }, redirect: "error", signal: AbortSignal.any([stop.signal, AbortSignal.timeout(55_000)]) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (result.status !== "completed" && result.status !== "busy") throw new Error("Invalid worker response");
    process.stdout.write(JSON.stringify({ at: new Date().toISOString(), status: result.status, checked: result.checked, failed: result.failed, triggered: result.triggered }) + "\n");
  } catch (error) {
    if (stop.signal.aborted) break;
    // Never log bearer tokens, URLs, raw upstream responses, or monitor/user data.
    process.stderr.write(`Monitor run failed (${error instanceof Error && /^HTTP \d{3}$/.test(error.message) ? error.message : "transport or response error"}).\n`);
    if (!loop) process.exitCode = 1;
  }
  if (!loop || stop.signal.aborted) break;
  try { await delay(seconds * 1000, undefined, { signal: stop.signal }); } catch { break; }
} while (!stop.signal.aborted);
