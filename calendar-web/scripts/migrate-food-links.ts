/**
 * Migration: create food_item_links table.
 * Run with: DATABASE_URL=<your-neon-url> npx tsx scripts/migrate-food-links.ts
 */

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Creating food_item_links table...");

  await sql`
    CREATE TABLE IF NOT EXISTS food_item_links (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL,
      food_item_id TEXT NOT NULL,
      store_name TEXT NOT NULL,
      url TEXT NOT NULL,
      price REAL,
      created_at TEXT DEFAULT (NOW()::TEXT)
    )
  `;

  console.log("Migration complete.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
