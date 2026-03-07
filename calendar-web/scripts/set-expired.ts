import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function run() {
  const [user] = await sql`SELECT id, family_id FROM users WHERE email = 'tyler.e.stauss@gmail.com'`;
  console.log("User:", user);

  await sql`
    UPDATE subscriptions SET status = 'expired', payment_method = NULL, comped_by = NULL, updated_at = NOW()::TEXT
    WHERE family_id = ${user.family_id}
  `;

  const [sub] = await sql`SELECT status FROM subscriptions WHERE family_id = ${user.family_id}`;
  console.log("Updated subscription status:", sub.status);
}

run().catch((err) => { console.error(err); process.exit(1); });
