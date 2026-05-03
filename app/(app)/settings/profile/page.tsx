import { requireTenantUserPage } from "@/lib/auth/middleware";

import { ProfileForm } from "./form";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const ctx = await requireTenantUserPage();
  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 className="t-h1" style={{ fontSize: "1.875rem", margin: 0 }}>
          Profile
        </h1>
        <p className="t-body" style={{ color: "var(--muted-1)", marginTop: 6, marginBottom: 0 }}>
          Your name and email are visible to others on your team. Your password is not.
        </p>
      </header>

      <ProfileForm
        initialName={ctx.user.name ?? ""}
        email={ctx.user.email}
        role={ctx.user.role}
        tenantName={ctx.tenant.name}
      />
    </div>
  );
}
