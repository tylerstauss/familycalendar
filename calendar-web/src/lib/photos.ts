import fs from "fs";
import path from "path";

export const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");

export function familyUploadDir(familyId: string): string {
  const dir = path.join(UPLOADS_DIR, familyId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function photoFilePath(familyId: string, id: string, ext: string): string {
  return path.join(familyUploadDir(familyId), `${id}${ext}`);
}

export function deletePhotoFile(familyId: string, filename: string): void {
  const filePath = path.join(familyUploadDir(familyId), filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

export function getExtFromMime(mimeType: string): string | null {
  return ALLOWED_TYPES[mimeType] ?? null;
}
