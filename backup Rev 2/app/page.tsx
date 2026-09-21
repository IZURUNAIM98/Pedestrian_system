import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { SESSION_COOKIE, sessionIsValid } from "@/lib/demo-auth";

export default async function HomePage() {
  const cookieStore = await cookies();
  if (!sessionIsValid(cookieStore.get(SESSION_COOKIE)?.value)) redirect("/access");

  return <Dashboard />;
}
