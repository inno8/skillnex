import { requireRolePage } from "@/lib/auth/middleware";

export const dynamic = "force-dynamic";

export default async function TeamSettingsPage() {
  await requireRolePage(["owner", "admin"]);
  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 className="t-h1" style={{ fontSize: "1.875rem", margin: 0 }}>
          Team
        </h1>
        <p className="t-body" style={{ color: "var(--muted-1)", marginTop: 6 }}>
          Invite people to your tenant and manage their role + status.
        </p>
      </header>
      <div
        className="card"
        style={{
          padding: "32px 24px",
          textAlign: "center",
          color: "var(--muted-2)",
        }}
      >
        Team management ships in the next commit (Day 4 part B). The schema + invitation table are
        ready; the UI + invite-acceptance flow land next.
      </div>
    </div>
  );
}
