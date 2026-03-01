/**
 * Migration: create the meals table.
 * Run with: DATABASE_URL=<your-neon-url> npx tsx scripts/migrate-meals.ts
 */

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Creating meals table...");

  await sql`
    CREATE TABLE IF NOT EXISTS meals (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      food_item_ids TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (NOW()::TEXT)
    )
  `;

  console.log("Done.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
