import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getPhotoStream } from "@/lib/photos";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { id } = await params;
  const rows = await sql`SELECT url FROM photos WHERE id = ${id} AND family_id = ${familyId}`;
  const photo = rows[0] as { url: string } | undefined;

  if (!photo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { stream, contentType } = await getPhotoStream(photo.url);
  return new NextResponse(stream, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
