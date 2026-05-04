import Link from "next/link";

import { TopBar } from "@/components/topbar";
import { UploadDropzone } from "@/components/upload-dropzone";
import { requireTenantUserPage } from "@/lib/auth/middleware";
import { latestUpload } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Authenticated ingest surface — Step 1 of the cycle. Lives at /ingest so
 * it's not co-mounted with the marketing landing page (which always lives
 * at /). The sidebar's "Ingest" item points here.
 */
export default async function IngestPage() {
  const ctx = await requireTenantUserPage();

  let lastUpload = null;
  try {
    lastUpload = latestUpload(ctx.tenant.id);
  } catch {
    lastUpload = null;
  }

  const canIngest = ["owner", "admin", "manager"].includes(ctx.user.role);

  return (
    <>
      <TopBar crumbs={[{ label: "Ingest" }]} />
      <div
        className="fade-in"
        style={{ maxWidth: 880, margin: "0 auto", padding: "48px 24px 64px" }}
      >
        <div style={{ marginBottom: 32 }}>
          <div className="t-micro">Step 1 of 3 · Ingest · {ctx.tenant.name}</div>
          <h1 className="t-h1" style={{ margin: "6px 0 10px" }}>
            {canIngest
              ? "Drop your data. Skillnex drafts the performance reviews."
              : "Your performance review is being prepared."}
          </h1>
          <p className="t-body" style={{ color: "var(--muted-1)", maxWidth: "60ch" }}>
            {canIngest ? (
              <>
                Every performance review cycle — quarterly or annual — HR manually bridges Workday,
                Salesforce, Jira, and a dozen spreadsheets to give managers something factual to
                write from. Skillnex reads your workbook once, joins it, and flags where the data
                disagrees with the existing rating. Not a Lattice replacement — a way to replace the
                three days <em>before</em> you open Lattice.
              </>
            ) : (
              <>
                Your HR team uploads source data here every cycle. Once they do, a manager-approved
                performance review based on your actual contribution appears in your inbox — fair,
                sourced, something you can push back on with data.
              </>
            )}
          </p>
          {canIngest && lastUpload && (
            <p className="t-small" style={{ marginTop: 12, color: "var(--muted-2)" }}>
              Last upload:{" "}
              <span className="font-mono" style={{ fontSize: 12 }}>
                {lastUpload.filename}
              </span>{" "}
              · Shape {lastUpload.shape} ·{" "}
              <span className="tabular">{lastUpload.employee_count}</span> employees ·{" "}
              <span className="tabular">{new Date(lastUpload.uploaded_at).toLocaleString()}</span>
            </p>
          )}
        </div>

        {canIngest ? (
          <UploadDropzone />
        ) : (
          <div
            className="card"
            style={{
              padding: "32px 28px",
              textAlign: "center",
              color: "var(--muted-1)",
            }}
          >
            Upload is available to managers, admins, and owners. Reach out to your HR lead if you
            think this is wrong.{" "}
            <Link href="/dashboard" className="auth-link" style={{ marginLeft: 6 }}>
              Go to dashboard
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
