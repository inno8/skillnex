/**
 * Auth middleware — the single chokepoint that loads the session, fetches the
 * tenant, and validates the user is allowed to be here. Every API route and
 * every server-rendered page that touches tenant data MUST go through one of
 * these helpers.
 *
 * Two flavors:
 *  - *Api(req): throws HttpError(401|403|404) — wrap your handler in
 *    `apiHandler(...)` to convert thrown HttpErrors into Response objects.
 *  - *Page(): for server components — redirects to /login when there's no
 *    session, or to /dashboard?error=forbidden when the role is wrong.
 *
 * The shape returned (`{ session, user, tenant }`) is the only safe way to
 * get a `tenant_id` to pass into `lib/db` functions. Hard-coding tenant_id is
 * banned by an ESLint rule (next commit).
 */

import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { auditLog, type AuditAction } from "@/lib/auth/audit";
import { getDb } from "@/lib/db";

export type Role = "owner" | "admin" | "manager" | "employee";

export type Tenant = {
  id: string;
  name: string;
  region: "us" | "eu";
  plan: string;
  retention_days: number;
  deleted_at: string | null;
};

export type AuthedUser = {
  id: string;
  email: string;
  name: string | null;
  tenant_id: string;
  role: Role;
  status: "active" | "invited" | "suspended" | "deleted";
  employee_key: string | null;
};

export type AuthContext = {
  session: { id: string; userId: string };
  user: AuthedUser;
  tenant: Tenant;
};

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * Load the session + user row + tenant row in one shot. Returns null if no
 * valid session or the user/tenant has been soft-deleted or suspended. This
 * is the shared core for both the Api and Page variants.
 */
async function loadAuthContext(reqHeaders: Headers): Promise<AuthContext | null> {
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.user?.id || !session?.session?.id) return null;

  const db = getDb();
  // Pull the row directly so we get our extension fields (better-auth's typed
  // user object only includes its own columns by default).
  const userRow = db
    .prepare(
      `SELECT id, email, name, tenant_id, role, status, employee_key, soft_deleted_at
       FROM user WHERE id = ?`,
    )
    .get(session.user.id) as
    | {
        id: string;
        email: string;
        name: string | null;
        tenant_id: string;
        role: Role;
        status: AuthedUser["status"];
        employee_key: string | null;
        soft_deleted_at: string | null;
      }
    | undefined;
  if (!userRow) return null;
  if (userRow.status !== "active") return null;
  if (userRow.soft_deleted_at) return null;

  const tenantRow = db
    .prepare(
      `SELECT id, name, region, plan, retention_days, deleted_at
       FROM tenants WHERE id = ?`,
    )
    .get(userRow.tenant_id) as Tenant | undefined;
  if (!tenantRow) return null;
  if (tenantRow.deleted_at) return null;

  return {
    session: { id: session.session.id, userId: session.user.id },
    user: {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      tenant_id: userRow.tenant_id,
      role: userRow.role,
      status: userRow.status,
      employee_key: userRow.employee_key,
    },
    tenant: tenantRow,
  };
}

/* ---------- API variants (throw HttpError) ---------- */

export async function requireTenantUserApi(req: Request): Promise<AuthContext> {
  const ctx = await loadAuthContext(req.headers);
  if (!ctx) throw new HttpError(401, "Authentication required", "no_session");
  return ctx;
}

export async function requireRoleApi(req: Request, allowed: Role[]): Promise<AuthContext> {
  const ctx = await requireTenantUserApi(req);
  if (!allowed.includes(ctx.user.role)) {
    auditLog({
      tenant_id: ctx.tenant.id,
      user_id: ctx.user.id,
      action: "permission_denied",
      target_type: "route",
      target_id: new URL(req.url).pathname,
      ip_address: req.headers.get("x-forwarded-for"),
      user_agent: req.headers.get("user-agent"),
      details: { role: ctx.user.role, required: allowed },
    });
    throw new HttpError(
      403,
      `Your role (${ctx.user.role}) cannot perform this action`,
      "wrong_role",
    );
  }
  return ctx;
}

/**
 * Wrap an API handler so thrown HttpErrors become proper Response objects.
 * Anything else logs and returns 500.
 */
export function apiHandler<Args extends unknown[]>(
  fn: (req: Request, ...args: Args) => Promise<Response>,
): (req: Request, ...args: Args) => Promise<Response> {
  return async (req, ...args) => {
    try {
      return await fn(req, ...args);
    } catch (err) {
      if (err instanceof HttpError) {
        return new Response(JSON.stringify({ error: err.message, code: err.code }), {
          status: err.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      console.error("Unhandled API error", err);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  };
}

/* ---------- Page variants (redirect on failure) ---------- */

export async function requireTenantUserPage(): Promise<AuthContext> {
  const h = await nextHeaders();
  const ctx = await loadAuthContext(h);
  if (!ctx) redirect("/login");
  return ctx;
}

export async function requireRolePage(allowed: Role[]): Promise<AuthContext> {
  const ctx = await requireTenantUserPage();
  if (!allowed.includes(ctx.user.role)) {
    auditLog({
      tenant_id: ctx.tenant.id,
      user_id: ctx.user.id,
      action: "permission_denied",
      target_type: "page",
      details: { role: ctx.user.role, required: allowed },
    });
    redirect("/dashboard?error=forbidden");
  }
  return ctx;
}

/**
 * Read the session without redirecting. Used by the landing page (/) to
 * branch between marketing UI and the upload UI.
 */
export async function getOptionalAuth(): Promise<AuthContext | null> {
  const h = await nextHeaders();
  return loadAuthContext(h);
}

/**
 * Convenience helper to write an audit entry for an authenticated action.
 * Uses the request's IP/UA so callers don't have to repeat the boilerplate.
 */
export function auditFromRequest(
  ctx: AuthContext,
  req: Request,
  action: AuditAction,
  extras: {
    target_type?: string;
    target_id?: string;
    details?: Record<string, unknown>;
  } = {},
): void {
  auditLog({
    tenant_id: ctx.tenant.id,
    user_id: ctx.user.id,
    action,
    target_type: extras.target_type,
    target_id: extras.target_id,
    ip_address: req.headers.get("x-forwarded-for"),
    user_agent: req.headers.get("user-agent"),
    details: extras.details,
  });
}
