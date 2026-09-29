import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ZodError } from "zod";
import { SESSION_COOKIE, sessionIsValid } from "@/lib/demo-auth";
import { runSimulation, simulationInputSchema } from "@/lib/simulation";
import { normaliseTextPayload, withUtf8JsonContentType } from "@/lib/text-standard";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!sessionIsValid(cookieStore.get(SESSION_COOKIE)?.value)) {
    return withUtf8JsonContentType(NextResponse.json({ error: "Authorised demonstration access is required." }, { status: 401 }));
  }

  try {
    const input = simulationInputSchema.parse(await request.json());
    return withUtf8JsonContentType(NextResponse.json(normaliseTextPayload(runSimulation(input), "api")));
  } catch (error) {
    if (error instanceof ZodError) return withUtf8JsonContentType(NextResponse.json({ error: "Choose a valid crossing mode and scenario." }, { status: 400 }));
    return withUtf8JsonContentType(NextResponse.json({ error: error instanceof Error ? error.message : "Simulation failed." }, { status: 422 }));
  }
}
