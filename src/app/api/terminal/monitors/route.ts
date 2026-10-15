import { readJsonBody, requireSameOrigin } from "@/lib/terminal/trading-core";
import { createPersistentMonitor, listPersistentMonitors, monitorContext, monitorErrorResponse, monitorJson } from "@/lib/terminal/persistent-monitor-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return monitorJson(await listPersistentMonitors(await monitorContext())); }
  catch (error) { return monitorErrorResponse(error); }
}
export async function POST(request: Request) {
  try { requireSameOrigin(request); const context = await monitorContext(true); return monitorJson(await createPersistentMonitor(context, await readJsonBody(request)), 201); }
  catch (error) { return monitorErrorResponse(error); }
}
