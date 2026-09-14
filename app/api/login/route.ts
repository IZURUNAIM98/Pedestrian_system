import { NextResponse } from "next/server";
import { z } from "zod";
import { credentialsAreValid, createSessionToken, SESSION_COOKIE, SESSION_DURATION_SECONDS } from "@/lib/demo-auth";
import { withUtf8JsonContentType } from "@/lib/text-standard";

const loginSchema = z.object({
  id: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !credentialsAreValid(parsed.data.id, parsed.data.password)) {
    return withUtf8JsonContentType(NextResponse.json({ error: "The ID or password is incorrect." }, { status: 401 }));
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
  return withUtf8JsonContentType(response);
}
