import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileSettings from "./components/ProfileSettings";
import AuthNav from "@/app/components/AuthNav";
import Link from "next/link";

export const metadata: Metadata = {
  title: "My Profile | Neutralis.ai",
  description: "Manage your Neutralis.ai profile and account settings",
};

export default async function ProfilePage() {
  let user;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return (
      <div className="min-h-screen bg-[#050608] text-[#e8e9ea] flex items-center justify-center">
        <p className="text-red-400 text-sm">Profile error: {msg}</p>
      </div>
    );
  }

  if (!user) {
    redirect("/login?redirect=/profile");
  }

  return (
    <div className="min-h-screen bg-[#050608] text-[#e8e9ea]">
      <nav className="fixed top-0 z-50 w-full border-b border-[#22262d] bg-[#08090c]/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Neutralis.ai
            </Link>
            <span className="text-xs text-[#a1a8b3]">/</span>
            <span className="text-sm font-medium text-[#eceef0]">
              My Profile
            </span>
          </div>
          <ul className="flex items-center">
            <AuthNav />
          </ul>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-6 pt-24 pb-16">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold">My Profile</h1>
          <p className="text-sm text-[#a1a8b3] mt-1">
            Manage your account details.
          </p>
        </div>
        <ProfileSettings />
      </main>
    </div>
  );
}
