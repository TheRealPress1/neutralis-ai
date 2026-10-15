import { NextResponse } from "next/server";
import { MarketApiError, terminalMarketProvider } from "@/lib/terminal/markets";
import type { MarketCategory } from "@/lib/terminal/market-types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedCategory = (url.searchParams.get("category") ?? "").toLowerCase();
  const categories: MarketCategory[] = ["Politics", "Sports", "Crypto", "Economics"];
  const category = categories.find((item) => item.toLowerCase() === requestedCategory) ?? null;
  const headers = { "Cache-Control": "no-store" };
  if (requestedCategory && !["all", "all markets"].includes(requestedCategory) && !category) {
    return NextResponse.json({ error: "Unknown market category.", code: "INVALID_REQUEST" }, { status: 400, headers });
  }
  try {
    const feed = await terminalMarketProvider.getMarkets({ query: url.searchParams.get("q") ?? "", category });
    // The body remains useful for rendering an explicit exchange outage.
    return NextResponse.json(feed, { status: feed.status === "unavailable" ? 503 : 200, headers });
  } catch (error) {
    if (error instanceof MarketApiError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers });
    return NextResponse.json({ error: "Market data is temporarily unavailable.", code: "UPSTREAM_UNAVAILABLE" }, { status: 503, headers });
  }
}
