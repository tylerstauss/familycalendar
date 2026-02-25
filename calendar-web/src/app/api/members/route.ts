import { NextRequest, NextResponse } from "next/server";
import db, { newId } from "@/lib/db";
import { MEMBER_COLORS } from "@/lib/types";

export function GET() {
  const members = db.prepare("SELECT * FROM family_members ORDER BY created_at").all();
  return NextResponse.json(members);
}

export async function POST(req: NextRequest) {
  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const count = db.prepare("SELECT COUNT(*) as count FROM family_members").get() as { count: number };
  const color = MEMBER_COLORS[count.count % MEMBER_COLORS.length];
  const id = newId();

  db.prepare("INSERT INTO family_members (id, name, color) VALUES (?, ?, ?)").run(id, name.trim(), color);

  const member = db.prepare("SELECT * FROM family_members WHERE id = ?").get(id);
  return NextResponse.json(member, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const { id, ical_url } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "Member id is required" }, { status: 400 });
  }

  // Basic URL validation — allow empty string to clear
  const url = (ical_url || "").trim();
  if (url && !url.startsWith("https://")) {
    return NextResponse.json({ error: "URL must start with https://" }, { status: 400 });
  }

  db.prepare("UPDATE family_members SET ical_url = ? WHERE id = ?").run(url, id);
  const member = db.prepare("SELECT * FROM family_members WHERE id = ?").get(id);
  return NextResponse.json(member);
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  db.prepare("DELETE FROM family_members WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
