import { TopBar } from "@/components/topbar";
import { UploadDropzone } from "@/components/upload-dropzone";
import { latestUpload } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function HomePage() {
  let lastUpload = null;
  try {
    lastUpload = latestUpload();
  } catch {
    lastUpload = null;
  }

  return (
    <>
      <TopBar crumbs={[{ label: "Ingest" }]} />
      <div
        className="fade-in"
        style={{ maxWidth: 880, margin: "0 auto", padding: "48px 24px 64px" }}
      >
        <div style={{ marginBottom: 32 }}>
          <div className="t-micro">Step 1 of 3 · Ingest</div>
          <h1 className="t-h1" style={{ margin: "6px 0 10px" }}>
            Bring in this cycle's employee data.
          </h1>
          <p
            className="t-body"
            style={{ color: "var(--muted-1)", maxWidth: "60ch" }}
          >
            Drop the combined workbook — Sales, Engineering, Payroll, HR — or an
            HR-only file with Activity Log and Compensation. Skillnex joins the
            sheets, flags anomalies, and produces review-ready summaries. Nothing
            is fabricated; missing data shows as missing.
          </p>
          {lastUpload && (
            <p
              className="t-small"
              style={{ marginTop: 12, color: "var(--muted-2)" }}
            >
              Last upload:{" "}
              <span className="font-mono" style={{ fontSize: 12 }}>
                {lastUpload.filename}
              </span>{" "}
              · Shape {lastUpload.shape} ·{" "}
              <span className="tabular">{lastUpload.employee_count}</span>{" "}
              employees ·{" "}
              <span className="tabular">
                {new Date(lastUpload.uploaded_at).toLocaleString()}
              </span>
            </p>
          )}
        </div>

        <UploadDropzone />
      </div>
    </>
  );
}
