import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import db from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { familyUploadDir } from "@/lib/photos";

const MIME_FROM_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { id } = await params;
  const photo = db
    .prepare("SELECT filename FROM photos WHERE id = ? AND family_id = ?")
    .get(id, familyId) as { filename: string } | undefined;

  if (!photo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.join(familyUploadDir(familyId), photo.filename);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const ext = path.extname(photo.filename).toLowerCase();
  const contentType = MIME_FROM_EXT[ext] ?? "application/octet-stream";
  const buffer = fs.readFileSync(filePath);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
