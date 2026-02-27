import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import db, { newId } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { photoFilePath, deletePhotoFile, getExtFromMime } from "@/lib/photos";

const MAX_PHOTOS = 10;
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const photos = db
    .prepare("SELECT id, original_name, created_at FROM photos WHERE family_id = ? ORDER BY created_at")
    .all(familyId);
  return NextResponse.json(photos);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const count = db
    .prepare("SELECT COUNT(*) as n FROM photos WHERE family_id = ?")
    .get(familyId) as { n: number };
  if (count.n >= MAX_PHOTOS) {
    return NextResponse.json({ error: `Maximum ${MAX_PHOTOS} photos allowed` }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
  }

  const ext = getExtFromMime(file.type);
  if (!ext) {
    return NextResponse.json({ error: "Invalid file type. Use JPEG, PNG, GIF, or WebP." }, { status: 400 });
  }

  const id = newId();
  const filePath = photoFilePath(familyId, id, ext);
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  const filename = `${id}${ext}`;
  db.prepare(
    "INSERT INTO photos (id, family_id, filename, original_name) VALUES (?, ?, ?, ?)"
  ).run(id, familyId, filename, file.name);

  const photo = db
    .prepare("SELECT id, original_name, created_at FROM photos WHERE id = ?")
    .get(id);
  return NextResponse.json(photo, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "Photo id is required" }, { status: 400 });
  }

  const photo = db
    .prepare("SELECT filename FROM photos WHERE id = ? AND family_id = ?")
    .get(id, familyId) as { filename: string } | undefined;
  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  deletePhotoFile(familyId, photo.filename);
  db.prepare("DELETE FROM photos WHERE id = ? AND family_id = ?").run(id, familyId);
  return NextResponse.json({ ok: true });
}
