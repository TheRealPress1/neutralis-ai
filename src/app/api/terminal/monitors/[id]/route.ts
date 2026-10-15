import { readJsonBody, requireSameOrigin } from "@/lib/terminal/trading-core";
import { deletePersistentMonitor, monitorContext, monitorErrorResponse, monitorJson, updatePersistentMonitor } from "@/lib/terminal/persistent-monitor-server";
export const runtime = "nodejs";
export async function PATCH(request: Request, params: { params: Promise<{ id: string }> }) {
  try { requireSameOrigin(request); const context = await monitorContext(true); return monitorJson(await updatePersistentMonitor(context, (await params.params).id, await readJsonBody(request))); }
  catch (error) { return monitorErrorResponse(error); }
}
export async function DELETE(request: Request, params: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request); const context = await monitorContext(true);
    const rawVersion = new URL(request.url).searchParams.get("version");
    const version = rawVersion && /^[1-9]\d{0,9}$/.test(rawVersion) ? Number(rawVersion) : null;
    await deletePersistentMonitor(context, (await params.params).id, version);
    return new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return monitorErrorResponse(error); }
}
