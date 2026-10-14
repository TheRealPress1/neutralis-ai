import { NextResponse } from "next/server";
import { getTickerFeed } from "@/lib/market-ticker/provider";

export const dynamic = "force-dynamic";

export async function GET() {
  const feed = await getTickerFeed();
  return NextResponse.json(feed, {
    // The provider owns freshness/staleness; do not let a CDN relabel old
    // quotes as live. No user data or exchange credentials are involved.
    headers: { "Cache-Control": "no-store" },
  });
}
