import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { searchParams, pathname, origin } = request.nextUrl;
  const code = searchParams.get("code");

  // Supabase redirects back to the Site URL root with ?code=... after
  // email verification (recovery, signup, email change). Forward it to
  // /auth/callback so the code gets exchanged for a session.
  if (code && pathname === "/") {
    const url = new URL("/auth/callback", origin);
    url.searchParams.set("code", code);
    // Let the callback determine the destination
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
