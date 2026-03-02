import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql, newId } from "@/lib/db";
import { signSession, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { familyName, name, email, password } = await req.json();

  if (!familyName?.trim()) {
    return NextResponse.json({ error: "Family name is required" }, { status: 400 });
  }
  if (!name?.trim()) {
    return NextResponse.json({ error: "Your name is required" }, { status: 400 });
  }
  if (!email?.trim()) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  const existing = await sql`SELECT id FROM users WHERE email = ${normalizedEmail}`;
  if (existing.length > 0) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const familyId = newId();
  const userId = newId();

  await sql.transaction([
    sql`INSERT INTO families (id, name) VALUES (${familyId}, ${familyName.trim()})`,
    sql`INSERT INTO users (id, family_id, email, password_hash, name) VALUES (${userId}, ${familyId}, ${normalizedEmail}, ${passwordHash}, ${name.trim()})`,
  ]);

  const token = await signSession({ userId, familyId, email: normalizedEmail, name: name.trim(), role: "member" });
  const res = NextResponse.json(
    { user: { id: userId, name: name.trim(), email: normalizedEmail, familyId } },
    { status: 201 }
  );
  return setSessionCookie(res, token);
}
