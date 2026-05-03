import { redirect } from "next/navigation";
import { headers as nextHeaders } from "next/headers";

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
 * Idempotent: if there's no session, just redirects.
 */
export default async function LogoutPage() {
  const h = await nextHeaders();
  const session = await auth.api.getSession({ headers: h });

  if (session?.user?.id) {
    // Audit before signing out so we still have the user_id.
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

  redirect("/?signed_out=1");
}
