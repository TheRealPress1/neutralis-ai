import { NextResponse } from "next/server";
import { opportunityProvider } from "@/lib/terminal/opportunities";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    // An unavailable structured feed still carries venue health for the workspace.
    return NextResponse.json(await opportunityProvider.getOpportunities(), { headers });
  } catch {
    return NextResponse.json({ error: "Public comparison data is temporarily unavailable." }, { status: 503, headers });
  }
}
