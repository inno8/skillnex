/**
 * End-to-end test of the Resend email pipeline.
 *
 * Calls sendVerificationEmail() — the same function better-auth invokes
 * during signup — with a fake verify URL. Prints the resolved env config
 * and the Resend response so you can tell apart the failure modes:
 *
 *   ✓  delivered                  → check your inbox + spam
 *   ✗  Resend rejected            → the message tells you why
 *                                   (unverified domain, invalid recipient,
 *                                    sender disallowed, rate limit, etc.)
 *   ✗  RESEND_API_KEY missing     → script fell into mock mode
 *   ✗  network/throw              → API unreachable, key garbage, etc.
 *
 * Usage:
 *   npx tsx scripts/test-email.ts --to=you@yourdomain.com
 *   npm run test:email -- --to=you@yourdomain.com   (note the `--`)
 *
 * Optional:
 *   --intent=verify_email|reset_password|magic_link  (default verify_email)
 */
import { config as dotenv } from "dotenv";
dotenv({ path: ".env.local" });

import { sendVerificationEmail } from "@/lib/email/resend";

function arg(name: string, fallback?: string): string | undefined {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.replace(`--${name}=`, "") : fallback;
}

const to = arg("to");
const intent = (arg("intent", "verify_email") ?? "verify_email") as
  | "verify_email"
  | "reset_password"
  | "magic_link";

if (!to) {
  console.error("Usage: npx tsx scripts/test-email.ts --to=you@yourdomain.com");
  process.exit(1);
}
if (!["verify_email", "reset_password", "magic_link"].includes(intent)) {
  console.error(`--intent must be verify_email | reset_password | magic_link (got: ${intent})`);
  process.exit(1);
}

console.log("\n================================================================");
console.log("  Resend pipeline diagnostic");
console.log("================================================================");
console.log(`  RESEND_API_KEY    : ${process.env.RESEND_API_KEY ? "<present>" : "<MISSING>"}`);
console.log(
  `  RESEND_FROM_EMAIL : ${process.env.RESEND_FROM_EMAIL ?? "<not set — will fall back>"}`,
);
console.log(`  recipient         : ${to}`);
console.log(`  intent            : ${intent}`);
console.log("================================================================\n");

// Wrapped in a main() because tsx compiles to CJS, where top-level
// await is a syntax error (esbuild rejects it).
async function main(): Promise<number> {
  const start = Date.now();
  const result = await sendVerificationEmail({
    to: to as string,
    verifyUrl:
      "http://localhost:3000/api/auth/verify-email?token=TEST_TOKEN_NOT_REAL&callbackURL=%2F",
    intent,
  });
  const elapsed = Date.now() - start;

  console.log("");
  if (result.ok) {
    console.log(`✓  Resend accepted the message in ${elapsed}ms`);
    console.log(`   message id  : ${result.id}`);
    console.log(`   recipient   : ${to}`);
    console.log("");
    console.log("   What this means:");
    console.log("   - Resend's API received it. That's NOT the same as inbox delivery.");
    console.log("   - Check the inbox for that address (and spam).");
    console.log("   - If nothing arrives in 2-3 minutes, log into Resend → Logs →");
    console.log("     find this message id and look at the delivery status. Common");
    console.log("     causes: domain DNS still propagating, recipient domain rejected,");
    console.log("     or the recipient mailbox doesn't accept mail from your domain.");
    return 0;
  }

  console.log(`✗  Resend rejected the message in ${elapsed}ms`);
  console.log(`   error : ${result.error}`);
  console.log("");
  console.log("   Most common causes:");
  console.log("   - 'You can only send testing emails to your own address'");
  console.log("       → Your from-domain isn't verified yet. Verify it in Resend");
  console.log("         (Settings → Domains) and ensure DNS records are live.");
  console.log("   - 'Invalid `from` address'");
  console.log("       → RESEND_FROM_EMAIL doesn't match a verified domain.");
  console.log("   - 'Invalid API key' / 401");
  console.log("       → Rotate the key in Resend → API Keys, update .env.local.");
  return 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("✗  Threw before Resend could respond:", err);
    process.exit(1);
  });
