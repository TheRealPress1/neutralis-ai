/** Public contracts: persisted observation only; no trading/account capabilities. */
export type MonitorTarget = { kind: "market"; ticker: string } | { kind: "opportunity"; candidateId: string; pairDirection: "kalshi_yes_polymarket_no" | "polymarket_yes_kalshi_no" };
export type MonitorDirection = "above" | "below";
export type MonitorState = "watching" | "paused" | "triggered";
export interface CreateMonitorRequest { target: MonitorTarget; direction: MonitorDirection; threshold: number; label?: string }
export interface UpdateMonitorRequest { action: "pause" | "resume" | "rearm"; version: number }
export interface PersistentMonitor {
  id: string;
  target: MonitorTarget;
  label: string;
  direction: MonitorDirection;
  /** Dollars: YES last trade for market, gross spread before fees for opportunity. */
  threshold: number;
  state: MonitorState;
  version: number;
  armVersion: number;
  createdAt: string;
  updatedAt: string;
  nextCheckAt: string;
  lastCheckedAt: string | null;
  lastCheckStatus: "never" | "ok" | "unavailable" | "closed";
  /** Last successfully observed value; retained on failures with its original timestamp. */
  lastValue: number | null;
  lastObservedAt: string | null;
  lastError: string | null;
  triggeredAt: string | null;
}
export interface MonitorAlert {
  id: string;
  monitorId: string;
  armVersion: number;
  label: string;
  target: MonitorTarget;
  direction: MonitorDirection;
  threshold: number;
  observedValue: number;
  observedAt: string;
  createdAt: string;
  /** Pair alerts remain research signals, not executable/net-profit claims. */
  disclaimer: string;
}
export interface MonitorWorkerHealth {
  configured: boolean;
  status: "not_configured" | "never_run" | "healthy" | "degraded" | "stale";
  lastCompletedAt: string | null;
  lastCheckedCount: number;
  lastFailureCount: number;
  message: string;
}
export interface MonitorListResponse { monitors: PersistentMonitor[]; alerts: MonitorAlert[]; workerHealth: MonitorWorkerHealth; fetchedAt: string }
export interface MonitorMutationResponse { monitor: PersistentMonitor }
export interface MonitorErrorResponse { code: string; error: string }
export interface MonitorObservation {
  status: "ok" | "unavailable" | "closed";
  value: number | null;
  observedAt: string | null;
  error: string | null;
}
