import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db from "@/lib/db";
import { signSession, setSessionCookie } from "@/lib/auth";

interface UserRow {
  id: string;
  family_id: string;
  email: string;
  password_hash: string;
  name: string;
}

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email?.trim() || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const user = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email.toLowerCase().trim()) as UserRow | undefined;

  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const token = await signSession({
    userId: user.id,
    familyId: user.family_id,
    email: user.email,
    name: user.name,
  });

  const res = NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, familyId: user.family_id },
  });
  return setSessionCookie(res, token);
}
