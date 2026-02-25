import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "calendar.db");

// Ensure data directory exists
import fs from "fs";
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS family_members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    location TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    assignee_ids TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    ingredients TEXT DEFAULT '[]',
    instructions TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS grocery_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    checked INTEGER DEFAULT 0,
    recipe_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS meal_plans (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    meal_type TEXT NOT NULL,
    recipe_id TEXT,
    recipe_name TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    assignee_ids TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS family_calendars (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6366F1',
    ical_url TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Idempotent migration: add ical_url column to family_members
const columns = db.prepare("PRAGMA table_info(family_members)").all() as { name: string }[];
if (!columns.some((c) => c.name === "ical_url")) {
  db.exec("ALTER TABLE family_members ADD COLUMN ical_url TEXT DEFAULT ''");
}

// Migration: update old bold member colors to new soft pastels
const COLOR_MIGRATION: Record<string, string> = {
  "#4F46E5": "#E9D5FF", // indigo -> lavender
  "#DC2626": "#FECDD3", // red -> rose
  "#16A34A": "#CCFBF1", // green -> mint
  "#EA580C": "#FED7AA", // orange -> peach
  "#9333EA": "#BFDBFE", // purple -> blue
  "#0891B2": "#FDE68A", // cyan -> yellow
  "#DB2777": "#FBCFE8", // pink -> magenta
  "#CA8A04": "#D9F99D", // yellow -> lime
};

const migrateColors = db.prepare("UPDATE family_members SET color = ? WHERE color = ?");
const migrateTransaction = db.transaction(() => {
  for (const [oldColor, newColor] of Object.entries(COLOR_MIGRATION)) {
    migrateColors.run(newColor, oldColor);
  }
});
migrateTransaction();

export default db;

// Helper to generate IDs
export function newId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
