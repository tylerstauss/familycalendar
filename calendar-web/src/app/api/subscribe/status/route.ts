import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const [sub] = await sql`
    SELECT * FROM subscriptions WHERE family_id = ${familyId}
  `;

  return NextResponse.json(sub ?? null);
}
