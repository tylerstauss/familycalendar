/**
 * Migration: add recurrence column to events table.
 * Run with: DATABASE_URL=<your-neon-url> npx tsx scripts/migrate-events-fields.ts
 */

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Adding recurrence column to events...");

  await sql`
    ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence TEXT DEFAULT ''
  `;

  console.log("Done.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
