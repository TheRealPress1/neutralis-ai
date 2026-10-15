import { NextResponse } from "next/server";
import { opportunityProvider, parseOpportunityId } from "@/lib/terminal/opportunities";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const headers = { "Cache-Control": "no-store" };
  if (!parseOpportunityId(id)) return NextResponse.json({ error: "Invalid comparison identity." }, { status: 400, headers });
  try {
    const opportunity = await opportunityProvider.getOpportunity(id);
    if (!opportunity) return NextResponse.json({ error: "This comparison is closed, no longer matches, or its source data is unavailable." }, { status: 404, headers });
    return NextResponse.json(opportunity, { headers });
  } catch {
    return NextResponse.json({ error: "Public comparison data is temporarily unavailable." }, { status: 503, headers });
  }
}
