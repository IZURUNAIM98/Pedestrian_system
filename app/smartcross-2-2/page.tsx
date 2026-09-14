import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard";

export const metadata: Metadata = { title: "SmartCross 2.2" };

export default function SmartCrossLegacyPage() {
  return <Dashboard />;
}
