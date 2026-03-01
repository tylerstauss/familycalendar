/**
 * Migration: add chores/rewards tables.
 * Run with: DATABASE_URL=<your-neon-url> npx tsx scripts/migrate-chores.ts
 */

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Creating chores tables...");

  await sql`
    CREATE TABLE IF NOT EXISTS chores (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL,
      name TEXT NOT NULL,
      assignee_id TEXT NOT NULL,
      frequency TEXT DEFAULT 'daily',
      week_day INTEGER,
      due_date TEXT,
      star_value INTEGER DEFAULT 1,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (NOW()::TEXT)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS chore_completions (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL,
      chore_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT DEFAULT (NOW()::TEXT)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS rewards (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL,
      name TEXT NOT NULL,
      star_cost INTEGER DEFAULT 5,
      created_at TEXT DEFAULT (NOW()::TEXT)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS reward_redemptions (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL,
      reward_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      reward_name TEXT DEFAULT '',
      stars_spent INTEGER DEFAULT 0,
      date TEXT NOT NULL,
      created_at TEXT DEFAULT (NOW()::TEXT)
    )
  `;

  console.log("Chores migration complete.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
