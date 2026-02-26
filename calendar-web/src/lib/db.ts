import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "calendar.db");

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");

// Helper to generate IDs (defined early so migrations can use it)
export function newId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS families (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES families(id),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    created_at TEXT DEFAULT (datetime('now'))
  );

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

// Idempotent migration: add hidden column to family_members and family_calendars
const famMemberCols = db.prepare("PRAGMA table_info(family_members)").all() as { name: string }[];
if (!famMemberCols.some((c) => c.name === "hidden")) {
  db.exec("ALTER TABLE family_members ADD COLUMN hidden INTEGER DEFAULT 0");
}
const famCalCols = db.prepare("PRAGMA table_info(family_calendars)").all() as { name: string }[];
if (!famCalCols.some((c) => c.name === "hidden")) {
  db.exec("ALTER TABLE family_calendars ADD COLUMN hidden INTEGER DEFAULT 0");
}

// Idempotent migrations: add family_id to all existing tables
const tablesToMigrate = [
  "family_members",
  "events",
  "recipes",
  "grocery_items",
  "meal_plans",
  "family_calendars",
];
for (const table of tablesToMigrate) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === "family_id")) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN family_id TEXT DEFAULT ''`);
  }
}

// Data migration: assign orphaned rows to a default family
const orphanCheck = db.prepare(
  "SELECT COUNT(*) as n FROM family_members WHERE family_id = ''"
).get() as { n: number };

if (orphanCheck.n > 0) {
  const existing = db.prepare("SELECT id FROM families LIMIT 1").get() as { id: string } | undefined;
  const defaultFamilyId = existing?.id ?? newId();
  if (!existing) {
    db.prepare("INSERT INTO families (id, name) VALUES (?, ?)").run(defaultFamilyId, "Default Family");
  }
  for (const table of tablesToMigrate) {
    db.prepare(`UPDATE ${table} SET family_id = ? WHERE family_id = ''`).run(defaultFamilyId);
  }
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
