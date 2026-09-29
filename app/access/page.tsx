import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AccessForm } from "@/components/access-form";
import { SESSION_COOKIE, sessionIsValid } from "@/lib/demo-auth";

export const metadata: Metadata = { title: "Secure Access | SmartCross" };

export default async function AccessPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const cookieStore = await cookies();
  if (sessionIsValid(cookieStore.get(SESSION_COOKIE)?.value)) redirect("/");
  const params = await searchParams;

  return (
    <main className="access-page">
      <section className="access-panel" aria-labelledby="access-title">
        <div className="access-brand"><span aria-hidden="true">SC</span><div><strong>SmartCross</strong></div></div>
        <div className="access-copy"><span className="eyebrow">AUTHORISED DEMONSTRATION ACCESS</span><h1 id="access-title">Sign in to the simulator</h1><p>Enter the project credentials to review local crossing scenarios, incident timelines, and reports.</p></div>
        <AccessForm initialError={params.error ? "The ID or password is incorrect." : ""} />
        <div className="access-boundary"><strong>Prototype access only</strong><span>This sign-in protects a local demonstration. It is not connected to MPAJ identity systems and must not be used as production authentication.</span></div>
      </section>
      <aside className="access-visual" aria-label="Simulation boundary summary">
        <div className="smart-city-art" aria-hidden="true"><div className="city-building city-one" /><div className="city-building city-two" /><div className="city-building city-three" /><div className="city-road"><i /><i /><i /></div><span className="city-node node-one" /><span className="city-node node-two" /><span className="city-node node-three" /></div>
        <div className="access-visual-content"><span className="access-status"><i /> SMART CITY SIMULATION</span><h2>See safer streets as a connected system.</h2><p>Explore how crossings, people, vehicles, signals, and local review fit together across seven visible sequence stages.</p><ul><li>Normal and school crossings</li><li>20 normal-crossing and 21 school-crossing conditions</li><li>Protected WALK safety rule</li><li>Simulated CCTV plate evidence</li><li>PDF reporting</li></ul></div>
      </aside>
    </main>
  );
}
