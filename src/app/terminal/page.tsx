import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import TerminalWorkspace from "./components/TerminalWorkspace";

export const metadata: Metadata = {
  title: "Terminal | Neutralis.ai",
  description: "Live prediction markets, order books, positions, and price monitors in one workspace.",
};

export default async function TerminalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <TerminalWorkspace signedIn={Boolean(user)} userId={user?.id ?? null} />;
}
