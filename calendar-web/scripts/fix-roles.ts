import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const ADMIN_EMAIL = "tyler.e.stauss@gmail.com";

async function main() {
  // Set everyone to member first
  await sql`UPDATE users SET role = 'member'`;

  // Then promote the one true admin
  const result = await sql`
    UPDATE users SET role = 'admin'
    WHERE email = ${ADMIN_EMAIL}
    RETURNING id, email, name, role
  `;

  if (result.length === 0) {
    console.error(`Warning: ${ADMIN_EMAIL} not found in users table`);
  } else {
    console.log("Admin set:", result[0]);
  }

  const users = await sql`SELECT email, name, role FROM users ORDER BY created_at`;
  console.log("\nAll users after fix:");
  users.forEach((u) => console.log(`  [${u.role}] ${u.email} (${u.name})`));
}

main().catch(console.error);
