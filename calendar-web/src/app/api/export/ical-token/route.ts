import { NextRequest, NextResponse } from "next/server";
import { sql, newId } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

// GET — return the family's iCal token, generating one if needed
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  // Ensure column exists (idempotent)
  await sql`ALTER TABLE families ADD COLUMN IF NOT EXISTS ical_token TEXT DEFAULT ''`;

  const [family] = await sql`SELECT ical_token FROM families WHERE id = ${familyId}`;
  if (!family) return NextResponse.json({ error: "Family not found" }, { status: 404 });

  let token = family.ical_token as string | null;
  if (!token) {
    token = newId();
    await sql`UPDATE families SET ical_token = ${token} WHERE id = ${familyId}`;
  }

  return NextResponse.json({ token });
}

// DELETE — regenerate the token (revokes the old subscription URL)
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const token = newId();
  await sql`UPDATE families SET ical_token = ${token} WHERE id = ${familyId}`;
  return NextResponse.json({ token });
}
