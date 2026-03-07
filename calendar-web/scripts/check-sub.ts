import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
async function run() {
  const [user] = await sql`SELECT id, family_id FROM users WHERE email = 'tyler.e.stauss@gmail.com'`;
  const [sub] = await sql`SELECT status, plan, payment_method, current_period_end, stripe_subscription_id FROM subscriptions WHERE family_id = ${user.family_id}`;
  console.log("Subscription:", sub);
}
run().catch((err) => { console.error(err); process.exit(1); });
