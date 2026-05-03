/**
 * Mark a user as email-verified directly in the DB.
 *
 * Local-dev escape hatch for when you've signed up but the verification
 * email never arrived (Resend misconfigured, recipient in spam, etc.).
 * Idempotent: running it on an already-verified user is a no-op.
 *
 * Usage:
 *   npx tsx scripts/verify-user.ts --email=you@yourdomain.com
 *   npm run verify:user -- --email=you@yourdomain.com   (note the `--`)
 *
 * NB: `npm run` swallows --flag args unless you put them after a `--`
 * separator. The npx form is shorter and safer.
 */
import { config as dotenv } from "dotenv";
dotenv({ path: ".env.local" });

import { getDb } from "@/lib/db";

const arg = process.argv.find((a) => a.startsWith("--email="));
const email = arg
  ?.replace(/^--email=/, "")
  .trim()
  .toLowerCase();
if (!email) {
  console.error("Usage: npx tsx scripts/verify-user.ts --email=you@yourdomain.com");
  process.exit(1);
}

const db = getDb();
const row = db
  .prepare(`SELECT id, emailVerified, tenant_id FROM user WHERE email = ?`)
  .get(email) as { id: string; emailVerified: number; tenant_id: string } | undefined;

if (!row) {
  console.error(`No user found with email ${email}`);
  process.exit(1);
}

if (row.emailVerified === 1) {
  console.log(`✓ ${email} is already verified (user ${row.id}, tenant ${row.tenant_id}).`);
  process.exit(0);
}

db.prepare(`UPDATE user SET emailVerified = 1, updatedAt = ? WHERE email = ?`).run(
  new Date().toISOString(),
  email,
);

console.log(`✓ Verified ${email} (user ${row.id}, tenant ${row.tenant_id}).`);
console.log("  → sign in at  http://localhost:3000/login");
process.exit(0);
