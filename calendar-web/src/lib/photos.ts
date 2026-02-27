import { put, del } from "@vercel/blob";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

export function getExtFromMime(mimeType: string): string | null {
  return ALLOWED_TYPES[mimeType] ?? null;
}

export async function uploadPhotoBlob(
  familyId: string,
  id: string,
  ext: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const blob = await put(`photos/${familyId}/${id}${ext}`, buffer, {
    access: "public",
    contentType,
  });
  return blob.url;
}

export async function deletePhotoBlob(url: string): Promise<void> {
  await del(url);
}
