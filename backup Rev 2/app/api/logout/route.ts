import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/demo-auth";
import { withUtf8JsonContentType } from "@/lib/text-standard";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return withUtf8JsonContentType(response);
}
