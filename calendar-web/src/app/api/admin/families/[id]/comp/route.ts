import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { sql, newId } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.error;

  const { id: familyId } = await params;
  const { comped } = await req.json();

  if (comped) {
    const [existing] = await sql`SELECT id FROM subscriptions WHERE family_id = ${familyId}`;
    if (existing) {
      await sql`
        UPDATE subscriptions SET
          status = 'comped',
          payment_method = 'comped',
          comped_by = ${auth.session.userId},
          current_period_end = NULL,
          updated_at = NOW()::TEXT
        WHERE family_id = ${familyId}
      `;
    } else {
      const subId = newId();
      await sql`
        INSERT INTO subscriptions (id, family_id, status, payment_method, comped_by, created_at, updated_at)
        VALUES (${subId}, ${familyId}, 'comped', 'comped', ${auth.session.userId}, NOW()::TEXT, NOW()::TEXT)
      `;
    }
  } else {
    await sql`
      UPDATE subscriptions SET
        status = 'expired',
        comped_by = NULL,
        updated_at = NOW()::TEXT
      WHERE family_id = ${familyId}
    `;
  }

  const [sub] = await sql`SELECT * FROM subscriptions WHERE family_id = ${familyId}`;
  return NextResponse.json(sub);
}
