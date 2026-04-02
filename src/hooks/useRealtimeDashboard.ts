"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

const WATCHED_TABLES = [
  "positions",
  "signals",
  "decisions",
  "automation_state",
  "orders",
  "trades",
  "pipeline_logs",
  "market_snapshots",
  "market_matches",
] as const;

/** Minimum ms between onUpdate calls — prevents refetch storms during signal bursts. */
const THROTTLE_MS = 1_000;

/**
 * Subscribe to Supabase Realtime postgres_changes on dashboard-critical tables.
 * Calls `onUpdate` whenever any watched table receives an INSERT or UPDATE,
 * filtered by the current user's ID.
 *
 * Updates are throttled to at most once per THROTTLE_MS to avoid hammering
 * the API during high-signal-rate periods (e.g. 10 signals/sec).
 *
 * Returns `isConnected` so the UI can show a "Live" indicator.
 */
export function useRealtimeDashboard(onUpdate: () => void) {
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  // Throttle: track last fire time and pending trailing call
  const lastFiredRef = useRef(0);
  const trailingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const throttledUpdate = useRef(() => {
    const now = Date.now();
    const elapsed = now - lastFiredRef.current;

    if (elapsed >= THROTTLE_MS) {
      // Enough time passed — fire immediately
      lastFiredRef.current = now;
      onUpdateRef.current();
    } else if (!trailingRef.current) {
      // Schedule a trailing call so the last event in a burst is never lost
      trailingRef.current = setTimeout(() => {
        lastFiredRef.current = Date.now();
        trailingRef.current = null;
        onUpdateRef.current();
      }, THROTTLE_MS - elapsed);
    }
  }).current;

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function setup() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) return;

      const channel = supabase.channel("dashboard-realtime", {
        config: { broadcast: { self: true } },
      });

      for (const table of WATCHED_TABLES) {
        channel.on(
          "postgres_changes" as any,
          {
            event: "*",
            schema: "public",
            table,
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            throttledUpdate();
          },
        );
      }

      channel.subscribe((status) => {
        if (cancelled) return;
        setIsConnected(status === "SUBSCRIBED");
      });

      channelRef.current = channel;
    }

    setup();

    return () => {
      cancelled = true;
      if (trailingRef.current) clearTimeout(trailingRef.current);
      if (channelRef.current) {
        const supabase = createClient();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, []);

  return { isConnected };
}
