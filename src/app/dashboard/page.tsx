import type { Metadata } from "next";
import DashboardShell from "./components/DashboardShell";

export const metadata: Metadata = {
  title: "Dashboard | Neutralis.ai",
  description:
    "Portfolio monitoring dashboard for Neutralis.ai event hedge fund",
};

export default function DashboardPage() {
  return <DashboardShell />;
}
