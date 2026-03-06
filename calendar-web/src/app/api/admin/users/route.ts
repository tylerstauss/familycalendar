import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.error;

  const users = await sql`
    SELECT
      u.id,
      u.email,
      u.name,
      u.role,
      u.created_at,
      f.name AS family_name,
      COUNT(fm.id)::int AS member_count,
      COUNT(CASE WHEN fm.ical_url IS NOT NULL AND fm.ical_url != '' THEN 1 END)::int AS members_with_cal
    FROM users u
    LEFT JOIN families f ON f.id = u.family_id
    LEFT JOIN family_members fm ON fm.family_id = u.family_id
    GROUP BY u.id, u.email, u.name, u.role, u.created_at, f.name
    ORDER BY u.created_at ASC
  `;

  return NextResponse.json(users);
}
