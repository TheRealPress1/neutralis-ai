import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type"); // "recovery", "signup", "email"

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "recovery" | "signup" | "email",
    });

    if (!error) {
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/reset-password`);
      }
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=Could+not+verify+your+email.+Please+try+again.`,
  );
}
