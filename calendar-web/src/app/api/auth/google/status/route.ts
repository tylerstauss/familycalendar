import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;

  const rows = await sql`
    SELECT calendar_name, calendar_id FROM google_connections
    WHERE family_id = ${auth.session.familyId} LIMIT 1
  `;
  const conn = rows[0];
  if (!conn || conn.calendar_id === "pending") {
    return NextResponse.json({ connected: false });
  }
  return NextResponse.json({ connected: true, calendarName: conn.calendar_name });
}
