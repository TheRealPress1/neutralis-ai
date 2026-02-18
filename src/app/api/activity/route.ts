import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const eventType = searchParams.get("event_type");
  const entityType = searchParams.get("entity_type");
  const limit = Math.min(Number(searchParams.get("limit") ?? 100), 500);

  let query = (supabase as any)
    .from("audit_log")
    .select("id, event_type, entity_type, entity_id, details, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (eventType) query = query.eq("event_type", eventType);
  if (entityType) query = query.eq("entity_type", entityType);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
