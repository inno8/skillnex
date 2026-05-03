import { apiHandler, auditFromRequest, requireRoleApi } from "@/lib/auth/middleware";
import { buildExportSnapshot } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req) => {
  const ctx = await requireRoleApi(req, ["owner", "admin"]);
  const snapshot = buildExportSnapshot(ctx.tenant.id);

  auditFromRequest(ctx, req, "export_data", {
    target_type: "tenant",
    target_id: ctx.tenant.id,
    details: {
      members: snapshot.members.length,
      employees: snapshot.employees.length,
      uploads: snapshot.uploads.length,
      audit_log_rows: snapshot.audit_log.length,
    },
  });

  // Filename: tenant id + ISO date for sortability + uniqueness.
  const isoDate = new Date().toISOString().slice(0, 10);
  const filename = `skillnex-export-${ctx.tenant.id}-${isoDate}.json`;

  return new Response(JSON.stringify(snapshot, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
