/**
 * One-time script to create all Postgres tables in Neon.
 * Run with: DATABASE_URL=<your-neon-url> npx tsx scripts/setup-db.ts
 * Or set DATABASE_URL in your shell environment first.
 */

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function setup() {
  console.log("Creating tables...");

  await sql`
    CREATE TABLE IF NOT EXISTS families (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (NOW()::TEXT)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL REFERENCES families(id),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at TEXT DEFAULT (NOW()::TEXT)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS family_members (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      ical_url TEXT DEFAULT '',
      hidden INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (NOW()::TEXT)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      location TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      assignee_ids TEXT DEFAULT '[]',
      recurrence TEXT DEFAULT '',
      created_at TEXT DEFAULT (NOW()::TEXT)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      ingredients TEXT DEFAULT '[]',
      instructions TEXT DEFAULT '',
      created_at TEXT DEFAULT (NOW()::TEXT)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS grocery_items (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      checked INTEGER DEFAULT 0,
      recipe_id TEXT,
      created_at TEXT DEFAULT (NOW()::TEXT)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS meal_plans (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL,
      meal_type TEXT NOT NULL,
      recipe_id TEXT,
      recipe_name TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      assignee_ids TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (NOW()::TEXT)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS family_calendars (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6366F1',
      ical_url TEXT DEFAULT '',
      hidden INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (NOW()::TEXT)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL REFERENCES families(id),
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      created_at TEXT DEFAULT (NOW()::TEXT)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS food_items (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (NOW()::TEXT)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS meals (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      food_item_ids TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (NOW()::TEXT)
    )
  `;

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

  console.log("All tables created successfully.");
}

setup().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
