import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnboardingForm from "./components/OnboardingForm";

export const metadata: Metadata = {
  title: "Connect Your Accounts | Neutralis.ai",
  description: "Connect your Kalshi and Polymarket accounts to get started",
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/onboarding");
  }

  return (
    <div className="min-h-screen bg-[#050608] text-[#e8e9ea] flex items-center justify-center">
      <div className="w-full max-w-2xl px-6 py-16">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-semibold mb-2">
            Connect your accounts
          </h1>
          <p className="text-[#9ca3af]">
            Link your exchange API keys so Neutralis can monitor and execute
            trades. You can skip this and configure later in Settings.
          </p>
        </div>
        <OnboardingForm />
      </div>
    </div>
  );
}
