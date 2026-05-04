import { NextResponse } from "next/server";
import { z } from "zod";

import { auditLog } from "@/lib/auth/audit";
import { auth } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import { generateId } from "@/lib/db/backfill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const signupSchema = z.object({
  company_name: z.string().trim().min(2).max(100),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(10).max(128),
  region: z.enum(["us", "eu"]),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid signup payload",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 422 },
    );
  }
  const { company_name, name, email, password, region } = parsed.data;

  // Region pinning: every droplet runs with SKILLNEX_REGION set to its
  // physical datacenter (us | eu). Reject signups for the OTHER region —
  // otherwise a US-bound user could land on the EU droplet and silently
  // create a US tenant on EU infrastructure (or vice versa), breaking
  // the DPA's region-isolation promise on day one.
  //
  // For pilot we run a single US droplet, so EU signups are 409 here.
  // The signup form's "Where should your data live?" radio explains
  // the constraint and the marketing landing routes EU clicks to the
  // EU droplet (when one exists).
  const dropletRegion = process.env.SKILLNEX_REGION;
  if (dropletRegion && dropletRegion !== region) {
    const target = region === "eu" ? "https://app-eu.skillnex.tech" : "https://app.skillnex.tech";
    return NextResponse.json(
      {
        error: `Wrong region for this droplet — ${region.toUpperCase()} signups go to ${target}.`,
        code: "wrong_region",
        droplet_region: dropletRegion,
        requested_region: region,
        redirect_to: target,
      },
      { status: 409 },
    );
  }

  const db = getDb();

  // Reject if email already exists in any tenant — better-auth would catch it
  // but we want a clear error before creating the tenant row.
  const existing = db.prepare("SELECT id FROM user WHERE email = ?").get(email);
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 },
    );
  }

  // Create the tenant first so we have an id to attach the Owner to.
  const tenantId = generateId("tnt");
  const now = new Date().toISOString();
  // EU tenants are capped at 30-day retention by trigger; we set 30 explicitly
  // for EU, 90 for US.
  const retentionDays = region === "eu" ? 30 : 90;
  db.prepare(
    `INSERT INTO tenants (id, name, region, plan, retention_days, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(tenantId, company_name, region, "pilot", retentionDays, now);

  auditLog({
    tenant_id: tenantId,
    user_id: null,
    action: "tenant_created",
    target_type: "tenant",
    target_id: tenantId,
    details: { name: company_name, region, plan: "pilot" },
  });

  // Now create the Owner via better-auth's API.
  // better-auth's signUpEmail signature doesn't surface our `additionalFields`
  // (they're `input: false` by design), so we cast the body. The server still
  // applies the additional-field defaults from the auth config.
  type SignUpResult = { user?: { id?: string }; token?: string };
  let signupResult: SignUpResult;
  try {
    // Pass extension fields directly — better-auth's TypeScript types don't
    // surface additional fields, so we cast. Runtime accepts and persists them.
    signupResult = (await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
        tenant_id: tenantId,
        role: "owner",
        status: "active",
      },
    } as never)) as SignUpResult;
  } catch (err) {
    // Roll back the tenant we just created
    db.prepare("DELETE FROM tenants WHERE id = ?").run(tenantId);
    const msg = err instanceof Error ? err.message : "Signup failed";
    console.error("Signup failed for email", email, err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const userId = signupResult.user?.id;
  if (!userId) {
    db.prepare("DELETE FROM tenants WHERE id = ?").run(tenantId);
    return NextResponse.json({ error: "User creation failed (no id returned)" }, { status: 500 });
  }

  // tenant_id, role, status are persisted by better-auth via the extension
  // fields above. Nothing to update here.
  auditLog({
    tenant_id: tenantId,
    user_id: userId ?? null,
    action: "signup",
    target_type: "user",
    target_id: userId,
    ip_address: req.headers.get("x-forwarded-for") ?? null,
    user_agent: req.headers.get("user-agent") ?? null,
    details: { role: "owner", region },
  });

  return NextResponse.json(
    {
      ok: true,
      tenant_id: tenantId,
      user_id: userId,
      email,
      message: "Account created. Check your email to verify your address before signing in.",
    },
    { status: 201 },
  );
}
