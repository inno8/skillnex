import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/server";
import { auditLog } from "@/lib/auth/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /logout — server-side sign out.
 *
 * IMPORTANT: this is a Route Handler, NOT a Server Component page. The
 * earlier page.tsx version called `cookies().delete(...)`, which is a
 * silent no-op in pages — `cookies()` returns a READ-ONLY store inside
 * Server Components. Cookie mutations only work in Route Handlers,
 * Server Actions, or Middleware. That's why the session cookie kept
 * surviving the logout: better-auth's nextCookies plugin couldn't write
 * to the response from a server component, and our backup delete() was
 * a no-op.
 *
 * As a Route Handler we have full control over the Response object and
 * can attach Set-Cookie headers via `response.cookies.delete()` — those
 * actually fire because we're constructing the response ourselves.
 *
 * Hitting this URL from anywhere (sidebar, marketing nav, address bar,
 * a bookmark, an email link) destroys the session cookie and redirects
 * to the marketing landing with ?signed_out=1.
 *
 * Idempotent: if there's no session, just clears any stray cookies and
 * redirects.
 */

const SESSION_COOKIE_NAMES = [
  "better-auth.session_token",
  "better-auth.session_data",
  "__Secure-better-auth.session_token",
  "__Secure-better-auth.session_data",
];

export async function GET(req: Request) {
  // Audit + signOut BEFORE constructing the redirect so we still have
  // session context when writing the audit row.
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (session?.user?.id) {
      try {
        auditLog({
          tenant_id: (session.user as { tenant_id?: string }).tenant_id ?? "tnt_unknown",
          user_id: session.user.id,
          action: "logout",
          ip_address: req.headers.get("x-forwarded-for"),
          user_agent: req.headers.get("user-agent"),
        });
      } catch (err) {
        console.error("logout audit failed", err);
      }
      try {
        await auth.api.signOut({ headers: req.headers });
      } catch (err) {
        console.error("auth.api.signOut failed", err);
      }
    }
  } catch (err) {
    console.error("/logout: failed to read session", err);
  }

  // Build the redirect response and force-clear every session cookie.
  // response.cookies.delete() WORKS in route handlers (unlike cookies()
  // in server components). Belt-and-suspenders: explicit known names +
  // a sweep of any incoming cookie that smells like better-auth.
  //
  // Use SKILLNEX_BASE_URL (or x-forwarded-host) for the redirect target,
  // NOT req.url. Behind nginx, Next.js sees the request as hitting
  // 127.0.0.1:3000, so `new URL("/", req.url)` would point users at
  // localhost — fine in dev, broken in prod. The env var is the single
  // source of truth for "where users actually browse".
  const baseUrl = resolveBaseUrl(req);
  const res = NextResponse.redirect(new URL("/", baseUrl), { status: 303 });

  for (const name of SESSION_COOKIE_NAMES) {
    res.cookies.delete(name);
  }
  // Also iterate the request's cookies and kill anything that matches
  // /better.?auth/i — covers custom prefixes or future schema changes.
  for (const c of req.headers.get("cookie")?.split(";") ?? []) {
    const name = c.split("=")[0]?.trim();
    if (name && /better.?auth/i.test(name)) {
      res.cookies.delete(name);
    }
  }

  return res;
}

/**
 * Resolve the canonical base URL to redirect to, in priority order:
 *   1. SKILLNEX_BASE_URL  — explicit, set in .env.local on every droplet
 *   2. x-forwarded-host   — when nginx is set up correctly
 *   3. host header        — fallback for direct-hit setups
 *   4. req.url            — last-resort dev fallback (localhost:3000)
 *
 * Inlined rather than imported because logout runs in node runtime and
 * we want zero non-essential imports on the cookie-clearing path.
 */
function resolveBaseUrl(req: Request): string {
  if (process.env.SKILLNEX_BASE_URL) return process.env.SKILLNEX_BASE_URL;
  const xfh = req.headers.get("x-forwarded-host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  if (xfh) return `${proto}://${xfh}`;
  const host = req.headers.get("host");
  if (host) return `${proto}://${host}`;
  return new URL(req.url).origin;
}
