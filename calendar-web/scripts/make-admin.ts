import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const email = "tyler.e.stauss@gmail.com";
  await sql`UPDATE users SET role = 'admin' WHERE email = ${email}`;
  const rows = await sql`SELECT id, email, role FROM users WHERE email = ${email}`;
  if (rows.length === 0) {
    console.log(`No user found with email ${email}`);
  } else {
    console.log(`Updated: ${rows[0].email} → role: ${rows[0].role}`);
  }
}

main().catch(console.error);
