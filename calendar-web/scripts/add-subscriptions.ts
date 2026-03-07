/**
 * Migration script: creates the subscriptions table and seeds existing families as comped.
 * Run with: DATABASE_URL=<your-neon-url> npx tsx scripts/add-subscriptions.ts
 */

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Creating subscriptions table...");

  await sql`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL REFERENCES families(id) UNIQUE,
      status TEXT NOT NULL DEFAULT 'trialing',
      plan TEXT,
      payment_method TEXT,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      coinbase_charge_code TEXT,
      current_period_end TEXT,
      trial_ends_at TEXT,
      comped_by TEXT,
      created_at TEXT DEFAULT (NOW()::TEXT),
      updated_at TEXT DEFAULT (NOW()::TEXT)
    )
  `;

  console.log("Seeding existing families as comped...");

  const families = await sql`SELECT id FROM families`;
  console.log(`Found ${families.length} existing families.`);

  for (const family of families) {
    const id = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    await sql`
      INSERT INTO subscriptions (id, family_id, status, payment_method, created_at, updated_at)
      VALUES (${id}, ${family.id}, 'comped', 'comped', NOW()::TEXT, NOW()::TEXT)
      ON CONFLICT (family_id) DO NOTHING
    `;
    console.log(`  Comped family ${family.id}`);
  }

  console.log("Migration complete.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
