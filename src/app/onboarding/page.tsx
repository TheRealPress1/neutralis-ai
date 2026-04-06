import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnboardingWizard from "./components/OnboardingWizard";

export const metadata: Metadata = {
  title: "Get Started | Neutralis.ai",
  description: "Set up your Neutralis.ai account",
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/onboarding");
  }

  // If already completed onboarding, go to dashboard
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("onboarding_completed_at, first_name")
    .eq("id", user.id)
    .single();

  if (profile?.onboarding_completed_at) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex items-center justify-center">
      <div className="w-full max-w-2xl px-6 py-16">
        <OnboardingWizard firstName={profile?.first_name ?? ""} />
      </div>
    </div>
  );
}
