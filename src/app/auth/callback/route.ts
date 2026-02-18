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

      if (isRecovery) {
        return NextResponse.redirect(`${origin}/reset-password`);
      }

      // Check onboarding status — redirect new users to onboarding
      const userId = data.session?.user?.id;
      if (userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_completed_at")
          .eq("id", userId)
          .single();

        if (!profile?.onboarding_completed_at) {
          return NextResponse.redirect(`${origin}/onboarding`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Could+not+verify+your+email.+Please+try+again.`);
}
