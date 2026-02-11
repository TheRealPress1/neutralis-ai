import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "./components/DashboardShell";

export const metadata: Metadata = {
  title: "Dashboard | Neutralis.ai",
  description:
    "Portfolio monitoring dashboard for Neutralis.ai event hedge fund",
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
