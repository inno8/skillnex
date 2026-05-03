import { Sidebar } from "@/components/sidebar";
import { requireTenantUserPage } from "@/lib/auth/middleware";
import { countEmployeesForUser } from "@/lib/scoped-employees";

/**
 * (app) route group layout — wraps every authenticated app surface in
 * the sidebar chrome. The session check here is what redirects logged-out
 * visitors to /login when they try to hit /dashboard, /people, /ingest,
 * etc. Marketing (/), auth pages (/login, /signup, ...) live OUTSIDE
 * this group so they don't get the sidebar — and don't get auto-gated.
 */
export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireTenantUserPage();

  // Count what THIS user can see — owners/admins get the full tenant
  // count, managers get their assigned count, employees get 1 or 0.
  let employeeCount: number | null = null;
  try {
    employeeCount = countEmployeesForUser(ctx);
  } catch {
    employeeCount = null;
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar
        employeeCount={employeeCount}
        user={{
          name: ctx.user.name ?? ctx.user.email,
          email: ctx.user.email,
          role: ctx.user.role,
          tenantName: ctx.tenant.name,
          hasEmployeeKey: ctx.user.employee_key != null,
        }}
      />
      <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
    </div>
  );
}
