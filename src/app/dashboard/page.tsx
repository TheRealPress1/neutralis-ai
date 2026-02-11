import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "./components/DashboardShell";

export const metadata: Metadata = {
  title: "My Portfolio | Neutralis.ai",
  description:
    "Your portfolio dashboard for Neutralis.ai prediction market trading",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/dashboard");
  }

  return <DashboardShell />;
}
