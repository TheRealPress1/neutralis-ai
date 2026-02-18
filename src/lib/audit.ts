import { createClient } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/rate-limit";

interface AuditOpts {
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  userId?: string;
}

/**
 * Log a security-relevant event to the audit_log table.
 * Fire-and-forget — failures are silently caught so they never
 * break the calling server action.
 */
export function logAudit(eventType: string, opts: AuditOpts = {}): void {
  // Run async but don't await — non-blocking
  void (async () => {
    try {
      const supabase = await createClient();

      let userId = opts.userId;
      if (!userId) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        userId = user?.id;
      }

      const ip = await getClientIp();

      await (supabase as any).from("audit_log").insert({
        user_id: userId ?? null,
        event_type: eventType,
        entity_type: opts.entityType ?? null,
        entity_id: opts.entityId ?? null,
        details: opts.details ?? {},
        ip_address: ip,
      });
    } catch {
      // Never let audit logging break a server action
    }
  })();
}
