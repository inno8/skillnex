import Link from "next/link";

import { TopBar } from "@/components/topbar";
import { UploadDropzone } from "@/components/upload-dropzone";
import { getOptionalAuth } from "@/lib/auth/middleware";
import { latestUpload } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const ctx = await getOptionalAuth();

  // Unauthenticated visitors get the marketing landing page (no app chrome).
  if (!ctx) return <Marketing />;

  let lastUpload = null;
  try {
    lastUpload = latestUpload(ctx.tenant.id);
  } catch {
    lastUpload = null;
  }

  // Owners + admins + managers can ingest. Employees see a softer screen
  // pointing them toward their own review (Day 5 work — for now we just
  // explain why the upload isn't available to them).
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
              ? "Stop spending three days prepping data before every review cycle."
              : "Your review is being prepared."}
          </h1>
          <p className="t-body" style={{ color: "var(--muted-1)", maxWidth: "60ch" }}>
            {canIngest ? (
              <>
                Every review cycle, HR manually bridges Workday, Salesforce, Jira, and a dozen
                spreadsheets to give managers something factual to write from. Skillnex reads your
                workbook once, joins it, and flags where the data disagrees with the manager's
                rating. Not a Lattice replacement — a way to replace the three days <em>before</em>{" "}
                you open Lattice.
              </>
            ) : (
              <>
                Your HR team uploads source data here every cycle. Once they do, a manager-approved
                summary of your contribution will appear in your inbox.
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
              background: "var(--paper)",
            }}
          >
            Upload is available to managers, admins, and owners. Reach out to your HR lead if you
            think this is wrong.
          </div>
        )}
      </div>
    </>
  );
}

function Marketing() {
  return (
    <div
      className="fade-in"
      style={{
        maxWidth: 920,
        margin: "0 auto",
        padding: "120px 24px 80px",
      }}
    >
      <div style={{ marginBottom: 56 }}>
        <p className="t-micro" style={{ marginBottom: 12 }}>
          Skillnex
        </p>
        <h1
          className="t-h1"
          style={{
            fontSize: "3rem",
            margin: "0 0 20px",
            lineHeight: 1.1,
          }}
        >
          Replace the three days before you open Lattice.
        </h1>
        <p
          className="t-body"
          style={{
            color: "var(--muted-1)",
            maxWidth: "60ch",
            fontSize: 17,
            lineHeight: 1.55,
          }}
        >
          Skillnex joins your roster with compensation and activity data, flags where the numbers
          disagree with the rating, and writes a review-ready summary your managers can edit — not
          invent.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
          <Link
            href="/signup"
            className="btn btn-primary"
            style={{ height: 44, padding: "0 22px", textDecoration: "none" }}
          >
            Create your tenant
          </Link>
          <Link
            href="/login"
            className="btn btn-secondary"
            style={{ height: 44, padding: "0 22px", textDecoration: "none" }}
          >
            Sign in
          </Link>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 24,
          marginTop: 64,
          paddingTop: 32,
          borderTop: "1px solid var(--border)",
        }}
      >
        <Pillar
          title="Department-aware scoring"
          body="One ROI metric for Sales, another for Engineering, another for HR. We don't pretend a recruiter and an AE are the same job."
        />
        <Pillar
          title="Anomaly-first surface"
          body="Top of every page is the rows where the data and the rating disagree. The conversation worth having, not the spreadsheet to scroll."
        />
        <Pillar
          title="Tenant-isolated by design"
          body="Your data lives in your tenant. Region pinning and 30-day EU retention out of the box. DPA before any employee data is uploaded."
        />
      </div>
    </div>
  );
}

function Pillar({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.15rem",
          fontWeight: 500,
          marginBottom: 8,
          letterSpacing: "-0.005em",
          fontVariationSettings: '"opsz" 36',
        }}
      >
        {title}
      </div>
      <p className="t-small" style={{ color: "var(--muted-1)", lineHeight: 1.55 }}>
        {body}
      </p>
    </div>
  );
}
