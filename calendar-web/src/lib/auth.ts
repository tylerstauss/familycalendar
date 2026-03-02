import { SignJWT, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

export interface SessionPayload {
  userId: string;
  familyId: string;
  email: string;
  name: string;
  role: string;
}

if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET env var is not set");
const SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
const COOKIE = "session";
const EXPIRES = 30 * 24 * 60 * 60; // 30 days in seconds

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(SECRET);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

// For API route handlers — returns session or a 401 NextResponse
export async function requireAuth(
  req: NextRequest
): Promise<{ ok: true; session: SessionPayload } | { ok: false; error: NextResponse }> {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) {
    return { ok: false, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const session = await verifySession(token);
  if (!session) {
    return { ok: false, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true, session };
}

// For API route handlers — returns session or a 403 NextResponse if not admin
export async function requireAdmin(
  req: NextRequest
): Promise<{ ok: true; session: SessionPayload } | { ok: false; error: NextResponse }> {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth;
  if (auth.session.role !== "admin") {
    return { ok: false, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return auth;
}

// Sets session cookie on a response
export function setSessionCookie(res: NextResponse, token: string): NextResponse {
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: EXPIRES,
    path: "/",
  });
  return res;
}

export function clearSessionCookie(res: NextResponse): NextResponse {
  res.cookies.set(COOKIE, "", { maxAge: 0, path: "/" });
  return res;
}
