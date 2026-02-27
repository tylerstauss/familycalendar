import { NextRequest, NextResponse } from "next/server";
import { sql, newId } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { uploadPhotoBlob, deletePhotoBlob, getExtFromMime } from "@/lib/photos";

const MAX_PHOTOS = 10;
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const photos = await sql`
    SELECT id, original_name, url, created_at FROM photos WHERE family_id = ${familyId} ORDER BY created_at
  `;
  return NextResponse.json(photos);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const [countRow] = await sql`SELECT COUNT(*) as n FROM photos WHERE family_id = ${familyId}`;
  const count = parseInt(countRow.n as string, 10);
  if (count >= MAX_PHOTOS) {
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
  const buffer = Buffer.from(await file.arrayBuffer());
  const blobUrl = await uploadPhotoBlob(familyId, id, ext, buffer, file.type);

  const filename = `${id}${ext}`;
  await sql`
    INSERT INTO photos (id, family_id, filename, original_name, url)
    VALUES (${id}, ${familyId}, ${filename}, ${file.name}, ${blobUrl})
  `;

  const [photo] = await sql`SELECT id, original_name, url, created_at FROM photos WHERE id = ${id}`;
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

  const rows = await sql`SELECT url FROM photos WHERE id = ${id} AND family_id = ${familyId}`;
  const photo = rows[0] as { url: string } | undefined;
  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  await deletePhotoBlob(photo.url);
  await sql`DELETE FROM photos WHERE id = ${id} AND family_id = ${familyId}`;
  return NextResponse.json({ ok: true });
}
