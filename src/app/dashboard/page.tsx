import type { Metadata } from "next";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "LeadPilot — Agent Workspace",
  description: "Live, AI-qualified real estate leads for Skyline Realty NCR.",
};

export default function DashboardPage() {
  return <Dashboard />;
}
