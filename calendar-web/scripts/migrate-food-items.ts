/**
 * Migration: create food_items table.
 * Run with: npx tsx scripts/migrate-food-items.ts
 * (DATABASE_URL must be set in environment or .env.local)
 */

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Creating food_items table...");

  await sql`
    CREATE TABLE IF NOT EXISTS food_items (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (NOW()::TEXT)
    )
  `;

  console.log("Done.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
