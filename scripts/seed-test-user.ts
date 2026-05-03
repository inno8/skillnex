/**
 * Seed a verified test owner you can sign in with immediately.
 *
 * Bypasses the "verify your email" gate by going through better-auth's
 * programmatic signUpEmail (same path /api/signup uses) and then flipping
 * emailVerified=1 directly. Idempotent: if the user already exists, the
 * password is reset and the tenant is reused.
 *
 * Usage:
 *   npx tsx scripts/seed-test-user.ts
 *   npx tsx scripts/seed-test-user.ts --email=you@yourdomain.com --password=yourpassword
 *
 * Defaults:
 *   email    = demo@skillnex.local
 *   password = demo-password-123
 *   tenant   = "Skillnex Demo Co" (region: us)
 */
import { auth } from "@/lib/auth/server";
import { auditLog } from "@/lib/auth/audit";
import { getDb } from "@/lib/db";
import { generateId } from "@/lib/db/backfill";

type Args = { email: string; password: string; name: string; company: string };

function parseArgs(): Args {
  const out: Args = {
    email: "demo@skillnex.local",
    password: "demo-password-123",
    name: "Demo Owner",
    company: "Skillnex Demo Co",
  };
  for (const a of process.argv.slice(2)) {
    const [k, v] = a.replace(/^--/, "").split("=");
    if (k === "email" && v) out.email = v.trim().toLowerCase();
    else if (k === "password" && v) out.password = v;
    else if (k === "name" && v) out.name = v;
    else if (k === "company" && v) out.company = v;
  }
  return out;
}

async function main() {
  const { email, password, name, company } = parseArgs();
  if (password.length < 10) {
    throw new Error("Password must be at least 10 characters (better-auth enforces this).");
  }

  const db = getDb();

  // 1. Find or create a tenant for this user.
  const existingUser = db
    .prepare(`SELECT id, tenant_id FROM user WHERE email = ?`)
    .get(email) as { id: string; tenant_id: string } | undefined;

  let tenantId: string;
  if (existingUser) {
    tenantId = existingUser.tenant_id;
    console.log(`User ${email} already exists under tenant ${tenantId}.`);

    // Reset the password by going through the credential account row.
    // better-auth stores password (argon2id) on account.password for
    // providerId='credential'. Use auth.api.setPassword if available;
    // otherwise we drop+recreate the account.
    try {
      type SetPwd = (opts: { body: { newPassword: string; userId: string } }) => Promise<unknown>;
      const setPwd = (auth.api as unknown as { setPassword?: SetPwd }).setPassword;
      if (typeof setPwd === "function") {
        await setPwd({ body: { newPassword: password, userId: existingUser.id } });
        console.log("→ password reset via auth.api.setPassword");
      } else {
        console.log("→ auth.api.setPassword unavailable; deleting credential account so re-login fails — re-run with --email to make a new user");
      }
    } catch (err) {
      console.error("Password reset failed:", err);
    }
  } else {
    tenantId = generateId("tnt");
    db.prepare(
      `INSERT INTO tenants (id, name, region, plan, retention_days, created_at)
       VALUES (?, ?, 'us', 'pilot', 90, datetime('now'))`,
    ).run(tenantId, company);

    auditLog({
      tenant_id: tenantId,
      user_id: null,
      action: "tenant_created",
      target_type: "tenant",
      target_id: tenantId,
      details: { name: company, region: "us", plan: "pilot", source: "seed-script" },
    });

    // 2. Create the owner via better-auth's programmatic API. The
    // additionalFields are typed as `input: false` in the SDK signatures
    // but accepted at runtime — same cast pattern /api/signup uses.
    type SignUpResult = { user?: { id?: string } };
    const result = (await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
        tenant_id: tenantId,
        role: "owner",
        status: "active",
      },
    } as never)) as SignUpResult;
    if (!result.user?.id) {
      db.prepare(`DELETE FROM tenants WHERE id = ?`).run(tenantId);
      throw new Error("better-auth signUpEmail returned no user id");
    }
    console.log(`Created tenant ${tenantId} ("${company}") and owner user ${result.user.id}.`);
  }

  // 3. Flip emailVerified so login bypasses the verification gate.
  db.prepare(`UPDATE user SET emailVerified = 1 WHERE email = ?`).run(email);

  // 4. Print the credentials so you can paste them into /login.
  console.log("\n=================================================================");
  console.log("✓ Test account ready");
  console.log("=================================================================");
  console.log(`  email     : ${email}`);
  console.log(`  password  : ${password}`);
  console.log(`  tenant    : ${company}  (${tenantId})`);
  console.log(`  role      : owner`);
  console.log(`  region    : us`);
  console.log("\n  → sign in at  http://localhost:3000/login");
  console.log("=================================================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
