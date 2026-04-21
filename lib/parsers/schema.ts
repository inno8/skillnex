import * as XLSX from "xlsx";
import { z } from "zod";

const nonEmptyString = z.string().min(1);
const nonNegNumber = z.number().finite().nonnegative();
const positiveNumber = z.number().finite().positive();

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

const dateLike = z.preprocess((v) => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number" && Number.isFinite(v)) {
    // Excel serial date → YYYY-MM-DD via XLSX's own SSF helper.
    const parsed = XLSX.SSF.parse_date_code(v);
    if (parsed) return `${parsed.y}-${pad2(parsed.m)}-${pad2(parsed.d)}`;
  }
  if (typeof v === "string") {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return v;
  }
  return v;
}, z.string().regex(/^\d{4}-\d{2}-\d{2}/));

/* ---------- Shape A ---------- */

export const salesTeamRow = z.object({
  Rep_ID: nonEmptyString,
  Rep_Name: nonEmptyString,
  Region: z.string().optional().nullable(),
  Calls_Made: nonNegNumber.optional().nullable(),
  Emails_Sent: nonNegNumber.optional().nullable(),
  Meetings_Booked: nonNegNumber.optional().nullable(),
  Opportunities_Created: nonNegNumber.optional().nullable(),
  Deals_Closed: nonNegNumber.optional().nullable(),
  Revenue_Generated: nonNegNumber.optional().nullable(),
  Activity_Date: dateLike,
});
export type SalesTeamRow = z.infer<typeof salesTeamRow>;

export const engineeringRow = z.object({
  Engineer_ID: nonEmptyString,
  Engineer_Name: nonEmptyString,
  Projects_Assigned: nonNegNumber.optional().nullable(),
  Tasks_Completed: nonNegNumber.optional().nullable(),
  Bugs_Fixed: nonNegNumber.optional().nullable(),
  Code_Commits: nonNegNumber.optional().nullable(),
  Pull_Requests: nonNegNumber.optional().nullable(),
  Performance_Score: nonNegNumber.optional().nullable(),
  Activity_Date: dateLike,
});
export type EngineeringRow = z.infer<typeof engineeringRow>;

export const payrollRow = z.object({
  Employee_ID: nonEmptyString,
  Employee_Name: nonEmptyString,
  Department: nonEmptyString,
  Salary: positiveNumber,
  Bonus: nonNegNumber.optional().nullable(),
  Overtime_Hours: nonNegNumber.optional().nullable(),
  Performance_Rating: z.number().finite().min(0).max(5).optional().nullable(),
  Payroll_Date: dateLike.optional().nullable(),
});
export type PayrollRow = z.infer<typeof payrollRow>;

export const hrTeamShortRow = z.object({
  Employee_ID: nonEmptyString,
  Employee_Name: nonEmptyString,
  Activity_Type: z.string().optional().nullable(),
  Activity_Description: z.string().optional().nullable(),
  Activity_Date: dateLike,
  Duration_Hours: nonNegNumber.optional().nullable(),
  Employees_Impacted: nonNegNumber.optional().nullable(),
  Status: z.string().optional().nullable(),
});
export type HRTeamShortRow = z.infer<typeof hrTeamShortRow>;

/* ---------- Shape B ---------- */

export const hrActivityRow = z.object({
  Employee_ID: nonEmptyString,
  Employee_Name: nonEmptyString,
  Department: nonEmptyString,
  Job_Title: z.string().optional().nullable(),
  Activity_Type: z.string().optional().nullable(),
  Activity_Description: z.string().optional().nullable(),
  Activity_Date: dateLike,
  Duration_Hours: nonNegNumber.optional().nullable(),
  Employees_Impacted: nonNegNumber.optional().nullable(),
  Cost_Center: z.string().optional().nullable(),
  Priority: z.enum(["Critical", "High", "Medium", "Low"]).optional().nullable(),
  Status: z.string().optional().nullable(),
  Notes: z.string().optional().nullable(),
});
export type HRActivityRow = z.infer<typeof hrActivityRow>;

export const hrCompensationRow = z.object({
  Employee_ID: nonEmptyString,
  Employee_Name: nonEmptyString,
  Department: nonEmptyString,
  Job_Title: z.string().optional().nullable(),
  Level: z.string().optional().nullable(),
  Employment_Type: z.string().optional().nullable(),
  Annual_Base_Salary: positiveNumber,
  Annual_Bonus_Target_Pct: z.number().finite().min(0).max(2).optional().nullable(),
  Annual_Bonus_Target_Amt: nonNegNumber.optional().nullable(),
  Annual_Equity_Grant: nonNegNumber.optional().nullable(),
  Total_Target_Comp: nonNegNumber.optional().nullable(),
  Health_Benefits_ER: nonNegNumber.optional().nullable(),
  "401k_Match_ER": nonNegNumber.optional().nullable(),
  Other_Benefits_ER: nonNegNumber.optional().nullable(),
  Total_Benefits_Cost_ER: nonNegNumber.optional().nullable(),
  Total_Cost_to_Company: nonNegNumber.optional().nullable(),
  Hire_Date: z.string().optional().nullable(),
  Pay_Frequency: z.string().optional().nullable(),
  FLSA_Status: z.string().optional().nullable(),
  Location: z.string().optional().nullable(),
});
export type HRCompensationRow = z.infer<typeof hrCompensationRow>;

/* ---------- Shape detection ---------- */

export const SHAPE_A_SHEETS = {
  required: ["Sales Team", "Engineering", "Payroll data"] as const,
  optional: ["HR team"] as const,
};

export const SHAPE_B_SHEETS = {
  required: ["HR Activity Log", "Employee Compensation"] as const,
  optional: ["Summary Dashboard"] as const,
};

export type Shape = "A" | "B";

export function detectShape(sheetNames: string[]): Shape | null {
  const set = new Set(sheetNames.map((n) => n.trim()));
  const isA = SHAPE_A_SHEETS.required.every((s) => set.has(s));
  const isB = SHAPE_B_SHEETS.required.every((s) => set.has(s));
  if (isA) return "A";
  if (isB) return "B";
  return null;
}
