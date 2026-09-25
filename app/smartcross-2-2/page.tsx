import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { SESSION_COOKIE, sessionIsValid } from "@/lib/demo-auth";

export const metadata: Metadata = { title: "SmartCross" };

export default async function SmartCrossLegacyPage() {
  const cookieStore = await cookies();
  if (!sessionIsValid(cookieStore.get(SESSION_COOKIE)?.value)) redirect("/access");

  return <Dashboard />;
}
