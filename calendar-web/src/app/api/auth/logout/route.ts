import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export function POST() {
  const res = NextResponse.json({ ok: true });
  return clearSessionCookie(res);
}
