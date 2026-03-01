import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;

  const { calendarId, calendarName } = await req.json();
  if (!calendarId) return NextResponse.json({ error: "calendarId required" }, { status: 400 });

  await sql`
    UPDATE google_connections
    SET calendar_id = ${calendarId}, calendar_name = ${calendarName || calendarId}
    WHERE family_id = ${auth.session.familyId}
  `;
  return NextResponse.json({ ok: true });
}
