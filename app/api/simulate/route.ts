import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { runSimulation, simulationInputSchema } from "@/lib/simulation";
import { normaliseTextPayload, withUtf8JsonContentType } from "@/lib/text-standard";

export async function POST(request: Request) {
  try {
    const input = simulationInputSchema.parse(await request.json());
    return withUtf8JsonContentType(NextResponse.json(normaliseTextPayload(runSimulation(input), "api")));
  } catch (error) {
    if (error instanceof ZodError) return withUtf8JsonContentType(NextResponse.json({ error: "Choose a valid crossing mode and scenario." }, { status: 400 }));
    return withUtf8JsonContentType(NextResponse.json({ error: error instanceof Error ? error.message : "Simulation failed." }, { status: 422 }));
  }
}
