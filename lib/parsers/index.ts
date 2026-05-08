import type { ParseResult } from "@/lib/types";

import { FlexibleParseError, parseFlexibleSheet } from "./flexible";
import { joinShapeA, joinShapeB } from "./join";
import { detectShape } from "./schema";
import {
  MultiSheetPickError,
  ParseError,
  parseWorkbook,
  readSheetRows,
  readWorkbook,
} from "./xlsx";

export { ParseError, MultiSheetPickError } from "./xlsx";
export { FlexibleParseError } from "./flexible";
export type { ParseResult } from "@/lib/types";

/**
 * Try every shape we know in priority order:
 *
 *   1. Shape A — Sales/Engineering/Payroll workbook (the demo dataset)
 *   2. Shape B — HR Activity Log + Compensation workbook
 *   3. Shape C — flexible "single-sheet pile of HR data" (catch-all)
 *
 * If the workbook doesn't match Shape A or B AND has more than one
 * sheet, we throw `MultiSheetPickError` — the caller (upload route)
 * turns it into a 422 with the sheet list, the UI shows a picker, the
 * user re-submits with `sheetHint`, and we lock onto that sheet.
 *
 * `tenantDefaultDept` is used by Shape C when no department column
 * exists in the file. Pilot default is "Unspecified" but customers
 * can override per-tenant later (e.g. healthcare → "Clinical Staff").
 */
export function parseSkillnexWorkbook(
  buffer: ArrayBuffer | Uint8Array | Buffer,
  opts: { sheetHint?: string; tenantDefaultDept?: string } = {},
): ParseResult {
  const wb = readWorkbook(buffer);

  // Sheet was explicitly chosen by the user — go straight to Shape C
  // against that sheet. Skip A/B detection so a partial schema match
  // doesn't override the user's pick.
  if (opts.sheetHint) {
    return parseFlexibleAgainst(wb, opts.sheetHint, opts.tenantDefaultDept);
  }

  // Try Shape A or B by sheet-name detection.
  const knownShape = detectShape(wb.SheetNames);
  if (knownShape) {
    const parsed = parseWorkbook(buffer);
    const joined = parsed.shape === "A" ? joinShapeA(parsed) : joinShapeB(parsed);
    if (joined.employees.length === 0) {
      throw new ParseError("No employees produced from workbook", {
        rowCounts: parsed.rowCounts,
      });
    }
    return {
      shape: parsed.shape,
      employees: joined.employees,
      unjoined_names: joined.unjoined_names,
      row_counts: parsed.rowCounts,
      date_range: joined.date_range,
    };
  }

  // No known shape. Single sheet (CSV or one-tab xlsx) → run Shape C.
  // Multi-sheet → ask the user which one.
  if (wb.SheetNames.length === 1) {
    return parseFlexibleAgainst(wb, wb.SheetNames[0], opts.tenantDefaultDept);
  }
  throw new MultiSheetPickError(wb.SheetNames, {
    reason: "no_known_shape",
  });
}

function parseFlexibleAgainst(
  wb: ReturnType<typeof readWorkbook>,
  sheetName: string,
  tenantDefaultDept?: string,
): ParseResult {
  const rows = readSheetRows(wb, sheetName);
  const result = parseFlexibleSheet(rows, {
    sheetName,
    tenant_default_dept: tenantDefaultDept,
  });
  const dates = result.employees
    .flatMap((e) => [e.snapshot_date_range.from, e.snapshot_date_range.to])
    .sort();
  return {
    shape: "C" as const as ParseResult["shape"],
    employees: result.employees,
    unjoined_names: [],
    row_counts: { [sheetName]: result.detected.raw_row_count },
    date_range: {
      from: dates[0] ?? new Date().toISOString().slice(0, 10),
      to: dates[dates.length - 1] ?? new Date().toISOString().slice(0, 10),
    },
  };
}
