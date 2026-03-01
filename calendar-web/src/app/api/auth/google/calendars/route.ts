import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getConnection, listCalendars } from "@/lib/google-calendar";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;

  const conn = await getConnection(auth.session.familyId);
  if (!conn) return NextResponse.json({ error: "Not connected" }, { status: 401 });

  const calendars = await listCalendars(conn.access_token as string);
  return NextResponse.json(calendars);
}
