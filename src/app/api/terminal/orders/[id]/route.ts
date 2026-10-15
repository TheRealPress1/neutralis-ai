import { requireSameOrigin } from "@/lib/terminal/trading-core";
import { cancelTradingOrder, tradingContext, tradingErrorResponse, tradingJson } from "@/lib/terminal/trading-server";
export const runtime = "nodejs";
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request);
    const account = await tradingContext(true);
    const { id } = await context.params;
    return tradingJson(await cancelTradingOrder(account, id));
  } catch (error) { return tradingErrorResponse(error); }
}
