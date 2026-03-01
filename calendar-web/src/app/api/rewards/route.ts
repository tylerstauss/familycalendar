import { NextRequest, NextResponse } from "next/server";
import { sql, newId } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const rewards = await sql`
    SELECT * FROM rewards WHERE family_id = ${familyId} ORDER BY created_at ASC
  `;

  return NextResponse.json(rewards);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { name, star_cost } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const id = newId();
  await sql`
    INSERT INTO rewards (id, family_id, name, star_cost)
    VALUES (${id}, ${familyId}, ${name.trim()}, ${star_cost ?? 5})
  `;

  const [reward] = await sql`SELECT * FROM rewards WHERE id = ${id}`;
  return NextResponse.json(reward, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { id } = await req.json();
  await sql`DELETE FROM rewards WHERE id = ${id} AND family_id = ${familyId}`;
  return NextResponse.json({ ok: true });
}
