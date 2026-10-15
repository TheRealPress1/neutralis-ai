import { readJsonBody, requireSameOrigin } from "@/lib/terminal/trading-core";
import { previewTradingOrder, tradingContext, tradingErrorResponse, tradingJson } from "@/lib/terminal/trading-server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const context = await tradingContext(true);
    return tradingJson(await previewTradingOrder(context, await readJsonBody(request)));
  } catch (error) { return tradingErrorResponse(error); }
}
