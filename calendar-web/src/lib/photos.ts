import { put, del, get } from "@vercel/blob";

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
    access: "private",
    contentType,
  });
  return blob.url;
}

export async function getPhotoStream(url: string): Promise<{ stream: ReadableStream; contentType: string }> {
  const result = await get(url, { access: "private" });
  if (!result?.stream) {
    throw new Error("Blob stream unavailable");
  }
  return {
    stream: result.stream as ReadableStream,
    contentType: result.blob?.contentType || "application/octet-stream",
  };
}

export async function deletePhotoBlob(url: string): Promise<void> {
  await del(url);
}
