import { NextResponse } from "next/server";

const PYTHON_API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Cache the last successful health response for 1s to coalesce concurrent requests. */
let cachedResponse: Record<string, unknown> | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 1_000;

export async function GET() {
  const now = Date.now();

  // Return cached if fresh
  if (cachedResponse && now - cachedAt < CACHE_TTL_MS) {
    return NextResponse.json(cachedResponse);
  }

  try {
    const res = await fetch(`${PYTHON_API_BASE}/api/engine/health`, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    cachedResponse = data;
    cachedAt = now;
    return NextResponse.json(data);
  } catch {
    // If we have a stale cache, return it as degraded rather than unreachable
    if (cachedResponse) {
      return NextResponse.json({ ...cachedResponse, _stale: true });
    }
    return NextResponse.json({ status: "unreachable" }, { status: 503 });
  }
}
