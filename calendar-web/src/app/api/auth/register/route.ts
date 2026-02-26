import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db, { newId } from "@/lib/db";
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

  // Check email not already taken
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase().trim());
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const familyId = newId();
  const userId = newId();

  // Insert family + user in a transaction
  const insert = db.transaction(() => {
    db.prepare("INSERT INTO families (id, name) VALUES (?, ?)").run(familyId, familyName.trim());
    db.prepare(
      "INSERT INTO users (id, family_id, email, password_hash, name) VALUES (?, ?, ?, ?, ?)"
    ).run(userId, familyId, email.toLowerCase().trim(), passwordHash, name.trim());
  });
  insert();

  const token = await signSession({ userId, familyId, email: email.toLowerCase().trim(), name: name.trim() });
  const res = NextResponse.json(
    { user: { id: userId, name: name.trim(), email: email.toLowerCase().trim(), familyId } },
    { status: 201 }
  );
  return setSessionCookie(res, token);
}
