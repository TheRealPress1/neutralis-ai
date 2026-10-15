import type { TerminalMarket } from "./market-types";

export interface PriceMonitor {
  id: string;
  ticker: string;
  title: string;
  direction: "above" | "below";
  threshold: number;
  state: "watching" | "paused" | "triggered";
  createdAt: string;
  lastCheckedAt: string | null;
  triggeredAt: string | null;
  observedPrice: number | null;
}

/** Monitors observe public prices only. They have no account or execution tools. */
export function evaluateMonitors(monitors: PriceMonitor[], markets: TerminalMarket[], now: number): PriceMonitor[] {
  const quotes = new Map<string, TerminalMarket>();
  for (const market of markets) {
    if (market.status !== "live" || market.lastPrice === null || !Number.isFinite(Date.parse(market.updatedAt))) continue;
    const previous = quotes.get(market.ticker);
    if (!previous || Date.parse(market.updatedAt) > Date.parse(previous.updatedAt)) quotes.set(market.ticker, market);
  }
  return monitors.map((monitor) => {
    if (monitor.state !== "watching") return monitor;
    const quote = quotes.get(monitor.ticker);
    if (!quote || quote.status !== "live" || quote.lastPrice === null || !Number.isFinite(quote.lastPrice)) return monitor;
    const checked = Date.parse(quote.updatedAt);
    if (!Number.isFinite(checked) || now - checked > 45_000 || checked > now + 5_000 || monitor.lastCheckedAt === quote.updatedAt) return monitor;
    const triggered = monitor.direction === "above" ? quote.lastPrice >= monitor.threshold : quote.lastPrice <= monitor.threshold;
    return { ...monitor, lastCheckedAt: quote.updatedAt, observedPrice: quote.lastPrice, state: triggered ? "triggered" : "watching", triggeredAt: triggered ? new Date(now).toISOString() : null };
  });
}

export function restoreMonitors(raw: unknown): PriceMonitor[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is PriceMonitor => Boolean(item && typeof item === "object" && typeof item.id === "string" && typeof item.ticker === "string" && typeof item.title === "string" && (item.direction === "above" || item.direction === "below") && Number.isFinite(item.threshold) && item.threshold > 0 && item.threshold < 1 && typeof item.createdAt === "string"))
    .slice(0, 8).map((item) => ({ ...item, state: item.state === "triggered" ? "triggered" : "paused", lastCheckedAt: null, observedPrice: null }));
}
