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
      f.name AS family_name
    FROM users u
    LEFT JOIN families f ON f.id = u.family_id
    ORDER BY u.created_at ASC
  `;

  return NextResponse.json(users);
}
