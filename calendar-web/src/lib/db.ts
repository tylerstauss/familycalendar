import { neon } from "@neondatabase/serverless";

export const sql = neon(process.env.DATABASE_URL!);

export function newId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
