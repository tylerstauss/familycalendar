/**
 * Migration: add google_connections table and google_event_id column.
 * Run in Neon SQL Editor:
 *
 * CREATE TABLE IF NOT EXISTS google_connections (
 *   id TEXT PRIMARY KEY,
 *   family_id TEXT NOT NULL UNIQUE,
 *   access_token TEXT NOT NULL,
 *   refresh_token TEXT NOT NULL,
 *   token_expiry TEXT NOT NULL,
 *   calendar_id TEXT NOT NULL,
 *   calendar_name TEXT NOT NULL DEFAULT '',
 *   created_at TEXT DEFAULT (NOW()::TEXT)
 * );
 *
 * ALTER TABLE events ADD COLUMN IF NOT EXISTS google_event_id TEXT DEFAULT '';
 */

import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Creating google_connections table...");
  await sql`
    CREATE TABLE IF NOT EXISTS google_connections (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL UNIQUE,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      token_expiry TEXT NOT NULL,
      calendar_id TEXT NOT NULL,
      calendar_name TEXT NOT NULL DEFAULT '',
      created_at TEXT DEFAULT (NOW()::TEXT)
    )
  `;
  console.log("Adding google_event_id to events...");
  await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS google_event_id TEXT DEFAULT ''`;
  console.log("Done.");
}

migrate().catch((err) => { console.error("Migration failed:", err); process.exit(1); });
