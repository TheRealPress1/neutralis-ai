import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Recovery sessions: send user to reset-password page
      const isRecovery = data.session?.user?.recovery_sent_at &&
        Date.now() - new Date(data.session.user.recovery_sent_at).getTime() < 600_000;
      const destination = isRecovery ? "/reset-password" : next;
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Could+not+verify+your+email.+Please+try+again.`);
}
