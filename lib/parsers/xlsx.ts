import * as XLSX from "xlsx";
import { z } from "zod";

import {
  detectShape,
  engineeringRow,
  hrActivityRow,
  hrCompensationRow,
  hrTeamShortRow,
  payrollRow,
  salesTeamRow,
  type EngineeringRow,
  type HRActivityRow,
  type HRCompensationRow,
  type HRTeamShortRow,
  type PayrollRow,
  type SalesTeamRow,
  type Shape,
} from "./schema";

export class ParseError extends Error {
  constructor(
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ParseError";
  }
}

export type SheetRows = {
  salesTeam?: SalesTeamRow[];
  engineering?: EngineeringRow[];
  payroll?: PayrollRow[];
  hrTeamShort?: HRTeamShortRow[];
  hrActivity?: HRActivityRow[];
  hrCompensation?: HRCompensationRow[];
};

export type WorkbookParse = {
  shape: Shape;
  rows: SheetRows;
  rowCounts: Record<string, number>;
};

function readSheet<T>(
  wb: XLSX.WorkBook,
  sheetName: string,
  schema: z.ZodType<T>,
): T[] {
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new ParseError(`Missing sheet: ${sheetName}`);
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    raw: true,
    defval: null,
    blankrows: false,
  });

  const rows: T[] = [];
  raw.forEach((row, idx) => {
    const allEmpty = Object.values(row).every(
      (v) => v === null || v === undefined || v === "",
    );
    if (allEmpty) return;
    // Skip summary/total rows: those where the name/key fields are empty
    // but some label lingers in the ID column (e.g., "TOTAL").
    const nameKey =
      "Employee_Name" in row
        ? "Employee_Name"
        : "Rep_Name" in row
          ? "Rep_Name"
          : "Engineer_Name" in row
            ? "Engineer_Name"
            : null;
    if (nameKey && (row[nameKey] === null || row[nameKey] === "")) return;
    const result = schema.safeParse(row);
    if (!result.success) {
      throw new ParseError(
        `Invalid row in sheet "${sheetName}" (row ${idx + 2}): ${result.error.issues
          .map((i) => `${i.path.join(".") || "row"} — ${i.message}`)
          .join("; ")}`,
        { sheet: sheetName, row: idx + 2, raw: row },
      );
    }
    rows.push(result.data);
  });
  return rows;
}

/**
 * Fill derived totals if the exported file left formula cells blank.
 * See DESIGN / PLAN §4.
 */
export function fillDerivedCompensation(
  row: HRCompensationRow,
): HRCompensationRow {
  const base = row.Annual_Base_Salary ?? 0;
  const pct = row.Annual_Bonus_Target_Pct ?? 0;
  const equity = row.Annual_Equity_Grant ?? 0;

  const bonusAmt = row.Annual_Bonus_Target_Amt ?? base * pct;
  const totalTargetComp = row.Total_Target_Comp ?? base + bonusAmt + equity;
  const totalBenefits =
    row.Total_Benefits_Cost_ER ??
    (row.Health_Benefits_ER ?? 0) +
      (row["401k_Match_ER"] ?? 0) +
      (row.Other_Benefits_ER ?? 0);
  const totalCost = row.Total_Cost_to_Company ?? totalTargetComp + totalBenefits;

  return {
    ...row,
    Annual_Bonus_Target_Amt: bonusAmt,
    Total_Target_Comp: totalTargetComp,
    Total_Benefits_Cost_ER: totalBenefits,
    Total_Cost_to_Company: totalCost,
  };
}

export function parseWorkbook(buffer: ArrayBuffer | Uint8Array | Buffer): WorkbookParse {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const shape = detectShape(wb.SheetNames);
  if (!shape) {
    throw new ParseError(
      "Unrecognized workbook shape. Expected either Shape A (Sales Team + Engineering + Payroll data) or Shape B (HR Activity Log + Employee Compensation).",
      { sheets: wb.SheetNames },
    );
  }

  if (shape === "A") {
    const salesTeam = readSheet(wb, "Sales Team", salesTeamRow);
    const engineering = readSheet(wb, "Engineering", engineeringRow);
    const payroll = readSheet(wb, "Payroll data", payrollRow);
    const hrTeamShort = wb.Sheets["HR team"]
      ? readSheet(wb, "HR team", hrTeamShortRow)
      : [];
    return {
      shape: "A",
      rows: { salesTeam, engineering, payroll, hrTeamShort },
      rowCounts: {
        "Sales Team": salesTeam.length,
        Engineering: engineering.length,
        "Payroll data": payroll.length,
        "HR team": hrTeamShort.length,
      },
    };
  }

  const hrActivity = readSheet(wb, "HR Activity Log", hrActivityRow);
  const hrCompensationRaw = readSheet(wb, "Employee Compensation", hrCompensationRow);
  const hrCompensation = hrCompensationRaw.map(fillDerivedCompensation);
  return {
    shape: "B",
    rows: { hrActivity, hrCompensation },
    rowCounts: {
      "HR Activity Log": hrActivity.length,
      "Employee Compensation": hrCompensation.length,
    },
  };
}
