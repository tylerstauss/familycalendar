import { NextRequest, NextResponse } from "next/server";
import db, { newId } from "@/lib/db";
import { MEMBER_COLORS } from "@/lib/types";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const members = db
    .prepare("SELECT * FROM family_members WHERE family_id = ? ORDER BY created_at")
    .all(familyId);
  return NextResponse.json(members);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const count = db
    .prepare("SELECT COUNT(*) as count FROM family_members WHERE family_id = ?")
    .get(familyId) as { count: number };
  const color = MEMBER_COLORS[count.count % MEMBER_COLORS.length];
  const id = newId();

  db.prepare(
    "INSERT INTO family_members (id, family_id, name, color) VALUES (?, ?, ?, ?)"
  ).run(id, familyId, name.trim(), color);

  const member = db
    .prepare("SELECT * FROM family_members WHERE id = ? AND family_id = ?")
    .get(id, familyId);
  return NextResponse.json(member, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { id, ical_url } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "Member id is required" }, { status: 400 });
  }

  const url = (ical_url || "").trim();
  if (url && !url.startsWith("https://")) {
    return NextResponse.json({ error: "URL must start with https://" }, { status: 400 });
  }

  db.prepare(
    "UPDATE family_members SET ical_url = ? WHERE id = ? AND family_id = ?"
  ).run(url, id, familyId);
  const member = db
    .prepare("SELECT * FROM family_members WHERE id = ? AND family_id = ?")
    .get(id, familyId);
  return NextResponse.json(member);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { id } = await req.json();
  db.prepare("DELETE FROM family_members WHERE id = ? AND family_id = ?").run(id, familyId);
  return NextResponse.json({ ok: true });
}
