import { readJsonBody, requireSameOrigin } from "@/lib/terminal/trading-core";
import { reconcileTradingOrder, tradingContext, tradingErrorResponse, tradingJson } from "@/lib/terminal/trading-server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const context = await tradingContext();
    const body = await readJsonBody(request);
    return tradingJson(await reconcileTradingOrder(context, body.previewToken));
  } catch (error) { return tradingErrorResponse(error); }
}
