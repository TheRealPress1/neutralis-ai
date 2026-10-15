"use client";

import { useRef, useState } from "react";
import type { CreateMonitorRequest, MonitorListResponse, MonitorMutationResponse, PersistentMonitor, UpdateMonitorRequest } from "@/lib/terminal/persistent-monitor-types";
import { terminalRequest, useTerminalData } from "./useTerminalData";

export function useSavedMonitors(signedIn: boolean) {
  const feed = useTerminalData<MonitorListResponse>(signedIn ? "/api/terminal/monitors" : null, 15_000);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uncertainSince, setUncertainSince] = useState<number | null>(null);
  const busy = useRef(false);
  // A poll already in flight when a save failed cannot reconcile that save.
  const createUncertain = uncertainSince !== null && feed.readStartedAt <= uncertainSince;

  async function mutation<T>(id: string, action: () => Promise<T>): Promise<T | null> {
    if (busy.current || !signedIn || (id === "create" && createUncertain)) return null;
    busy.current = true;
    setPending(id);
    setError(null);
    try {
      const result = await action();
      feed.refresh();
      return result;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The monitor could not be updated.";
      if (id === "create") setUncertainSince(Date.now());
      setError(id === "create" ? `${message} Refresh your saved records before retrying; the request may have completed.` : message);
      feed.refresh();
      return null;
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  return { ...feed, pending, mutationError: error, createUncertain,
    create: (input: CreateMonitorRequest) => mutation("create", () => terminalRequest<MonitorMutationResponse>("/api/terminal/monitors", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal: AbortSignal.timeout(15_000),
    })),
    update: (monitor: PersistentMonitor, action: UpdateMonitorRequest["action"]) => mutation(monitor.id, () => terminalRequest<MonitorMutationResponse>(`/api/terminal/monitors/${encodeURIComponent(monitor.id)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, version: monitor.version }), signal: AbortSignal.timeout(15_000),
    })),
    remove: (monitor: PersistentMonitor) => mutation(monitor.id, async () => {
      await terminalRequest<null>(`/api/terminal/monitors/${encodeURIComponent(monitor.id)}?version=${monitor.version}`, { method: "DELETE", signal: AbortSignal.timeout(15_000) });
      return true;
    }),
  };
}

export type SavedMonitorController = ReturnType<typeof useSavedMonitors>;
