import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { searchParams, pathname, origin } = request.nextUrl;
  const code = searchParams.get("code");

  // Supabase redirects back to the Site URL root with ?code= after
  // email verification (PKCE flow). Forward to /auth/callback.
  if (code && pathname === "/") {
    const url = new URL("/auth/callback", origin);
    url.searchParams.set("code", code);
    return NextResponse.redirect(url);
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
