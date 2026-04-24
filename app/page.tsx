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
            Stop spending three days prepping data before every review cycle.
          </h1>
          <p
            className="t-body"
            style={{ color: "var(--muted-1)", maxWidth: "60ch" }}
          >
            Every review cycle, HR manually bridges Workday, Salesforce, Jira, and
            a dozen spreadsheets to give managers something factual to write from.
            Skillnex reads your workbook once, joins it, and flags where the data
            disagrees with the manager's rating. Not a Lattice replacement — a way
            to replace the three days <em>before</em> you open Lattice.
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
