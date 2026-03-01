import { NextRequest, NextResponse } from "next/server";
import { sql, newId } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const completions = await sql`
    SELECT * FROM chore_completions WHERE family_id = ${familyId} AND date = ${date}
  `;

  return NextResponse.json(completions);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { chore_id, member_id, date } = await req.json();
  if (!chore_id || !member_id || !date) {
    return NextResponse.json({ error: "chore_id, member_id, date required" }, { status: 400 });
  }

  // Idempotent: skip if already completed
  const existing = await sql`
    SELECT id FROM chore_completions
    WHERE chore_id = ${chore_id} AND member_id = ${member_id} AND date = ${date} AND family_id = ${familyId}
  `;
  if (existing.length > 0) {
    return NextResponse.json({ ok: true });
  }

  const id = newId();
  await sql`
    INSERT INTO chore_completions (id, family_id, chore_id, member_id, date)
    VALUES (${id}, ${familyId}, ${chore_id}, ${member_id}, ${date})
  `;

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { chore_id, member_id, date } = await req.json();
  if (!chore_id || !member_id || !date) {
    return NextResponse.json({ error: "chore_id, member_id, date required" }, { status: 400 });
  }

  await sql`
    DELETE FROM chore_completions
    WHERE chore_id = ${chore_id} AND member_id = ${member_id} AND date = ${date} AND family_id = ${familyId}
  `;

  return NextResponse.json({ ok: true });
}
