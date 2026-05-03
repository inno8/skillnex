import { cookies, headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { auditLog } from "@/lib/auth/audit";

export const dynamic = "force-dynamic";

/**
 * /logout — server-side sign out.
 *
 * Hitting this URL from anywhere (sidebar, marketing nav, address bar,
 * a bookmark, an email link) destroys the better-auth session cookie
 * and bounces you to the marketing landing. Server-side because the
 * session cookie is httpOnly — we can't kill it from JS alone.
 *
 * Idempotent: if there's no session, just clears stale cookies and
 * redirects.
 *
 * NB on cookie clearing: better-auth's auth.api.signOut() is supposed
 * to set a clearing Set-Cookie via the nextCookies plugin, but in
 * practice when called from a server component followed by redirect()
 * the cookie sometimes survives. So we ALSO delete via cookies().delete()
 * on every known better-auth cookie name. Belt and suspenders.
 */
const SESSION_COOKIES = [
  "better-auth.session_token",
  "better-auth.session_data",
  "__Secure-better-auth.session_token",
  "__Secure-better-auth.session_data",
];

export default async function LogoutPage() {
  const h = await nextHeaders();
  const cookieStore = await cookies();

  const session = await auth.api.getSession({ headers: h });

  if (session?.user?.id) {
    try {
      auditLog({
        tenant_id: (session.user as { tenant_id?: string }).tenant_id ?? "tnt_unknown",
        user_id: session.user.id,
        action: "logout",
        ip_address: h.get("x-forwarded-for"),
        user_agent: h.get("user-agent"),
      });
    } catch (err) {
      console.error("logout audit failed", err);
    }

    try {
      await auth.api.signOut({ headers: h });
    } catch (err) {
      console.error("auth.api.signOut failed", err);
    }
  }

  // Force-delete every session cookie variant (dev http vs prod https,
  // any custom prefix). delete() on a name we don't have is a no-op,
  // so this is safe even when better-auth already cleared them.
  for (const name of SESSION_COOKIES) {
    try {
      cookieStore.delete(name);
    } catch (err) {
      console.error(`failed to delete cookie ${name}:`, err);
    }
  }
  // Sweep anything else that looks like a better-auth cookie — covers
  // custom prefixes, future schema changes, or stray cookieCache keys.
  for (const c of cookieStore.getAll()) {
    if (/better.?auth/i.test(c.name)) {
      try {
        cookieStore.delete(c.name);
      } catch (err) {
        console.error(`failed to sweep cookie ${c.name}:`, err);
      }
    }
  }

  redirect("/?signed_out=1");
}
