import { executeMonitorWorker, monitorErrorResponse, monitorJson, requireMonitorWorker } from "@/lib/terminal/persistent-monitor-server";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try { requireMonitorWorker(request); return monitorJson(await executeMonitorWorker()); }
  catch (error) { return monitorErrorResponse(error); }
}
