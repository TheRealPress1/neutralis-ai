import { getTradingAccount, tradingContext, tradingErrorResponse, tradingJson } from "@/lib/terminal/trading-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return tradingJson(await getTradingAccount(await tradingContext())); }
  catch (error) { return tradingErrorResponse(error); }
}
