import { NextResponse } from "next/server";
import { MarketApiError, terminalMarketProvider } from "@/lib/terminal/markets";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await context.params;
  const headers = { "Cache-Control": "no-store" };
  try {
    return NextResponse.json(await terminalMarketProvider.getMarket(ticker), { headers });
  } catch (error) {
    if (error instanceof MarketApiError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers });
    return NextResponse.json({ error: "Market data is temporarily unavailable.", code: "UPSTREAM_UNAVAILABLE" }, { status: 503, headers });
  }
}
