import { NextResponse } from "next/server";
import { z } from "zod";
import { credentialsAreValid, createSessionToken, SESSION_COOKIE, SESSION_DURATION_SECONDS } from "@/lib/demo-auth";
import { withUtf8JsonContentType } from "@/lib/text-standard";

const loginSchema = z.object({
  id: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const raw = contentType.includes("application/json")
    ? await request.json().catch(() => null)
    : Object.fromEntries(await request.formData().catch(() => new FormData()));
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success || !credentialsAreValid(parsed.data.id, parsed.data.password)) {
    if (!contentType.includes("application/json")) return new NextResponse(null, { status: 303, headers: { Location: "/access?error=1" } });
    return withUtf8JsonContentType(NextResponse.json({ error: "The ID or password is incorrect." }, { status: 401 }));
  }

  const response = contentType.includes("application/json")
    ? NextResponse.json({ ok: true })
    : new NextResponse(null, { status: 303, headers: { Location: "/" } });
  response.cookies.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
  return contentType.includes("application/json") ? withUtf8JsonContentType(response) : response;
}
