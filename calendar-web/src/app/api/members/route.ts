import { NextRequest, NextResponse } from "next/server";
import { sql, newId } from "@/lib/db";
import { MEMBER_COLORS } from "@/lib/types";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const members = await sql`
    SELECT * FROM family_members WHERE family_id = ${familyId} ORDER BY created_at
  `;
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

  const [countRow] = await sql`
    SELECT COUNT(*) as count FROM family_members WHERE family_id = ${familyId}
  `;
  const count = parseInt(countRow.count as string, 10);
  const color = MEMBER_COLORS[count % MEMBER_COLORS.length];
  const id = newId();

  await sql`
    INSERT INTO family_members (id, family_id, name, color) VALUES (${id}, ${familyId}, ${name.trim()}, ${color})
  `;

  const [member] = await sql`
    SELECT * FROM family_members WHERE id = ${id} AND family_id = ${familyId}
  `;
  return NextResponse.json(member, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { id, ical_url, hidden } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "Member id is required" }, { status: 400 });
  }

  if (hidden !== undefined) {
    await sql`
      UPDATE family_members SET hidden = ${hidden ? 1 : 0} WHERE id = ${id} AND family_id = ${familyId}
    `;
  }

  if (ical_url !== undefined) {
    const url = (ical_url || "").trim();
    if (url && !url.startsWith("https://")) {
      return NextResponse.json({ error: "URL must start with https://" }, { status: 400 });
    }
    await sql`
      UPDATE family_members SET ical_url = ${url} WHERE id = ${id} AND family_id = ${familyId}
    `;
  }

  const [member] = await sql`
    SELECT * FROM family_members WHERE id = ${id} AND family_id = ${familyId}
  `;
  return NextResponse.json(member);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { id } = await req.json();
  await sql`DELETE FROM family_members WHERE id = ${id} AND family_id = ${familyId}`;
  return NextResponse.json({ ok: true });
}
