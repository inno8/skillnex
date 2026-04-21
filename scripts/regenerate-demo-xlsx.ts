/**
 * Regenerates public/samples/skillnex-demo.xlsx from the user-provided
 * Data skillnex.xlsx at the repo root.
 *
 * The source file has only 43 Payroll rows but 50 Sales reps + 50 engineers.
 * 7 sales reps are missing from Payroll; 0 engineers are in Payroll at all.
 * This script keeps the Sales Team, Engineering, and HR team sheets as-is
 * and rebuilds the Payroll data sheet so every activity-sheet employee has
 * a salary row. Ranges are realistic by role and department.
 *
 * Usage: pnpm regenerate-demo
 */

import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

const SOURCE = path.join(process.cwd(), "Data skillnex.xlsx");
const OUT_DIR = path.join(process.cwd(), "public", "samples");
const OUT = path.join(OUT_DIR, "skillnex-demo.xlsx");

type Row = Record<string, string | number | Date | null>;

function readSheet(wb: XLSX.WorkBook, name: string): Row[] {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Missing required sheet: ${name}`);
  return XLSX.utils.sheet_to_json<Row>(ws, { raw: true, defval: null });
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function seededSalary(name: string, department: "Sales" | "Engineering", region?: string) {
  const seed = hash(`${department}|${name}`);
  if (department === "Sales") {
    const regionBase =
      region === "North America" ? 92000 : region === "Europe" ? 85000 : 80000;
    return regionBase + (seed % 25000);
  }
  return 105000 + (seed % 45000);
}

function seededBonus(name: string, salary: number) {
  const seed = hash(`bonus|${name}`);
  return Math.round((0.04 + (seed % 80) / 1000) * salary);
}

function seededRating(name: string, signal: number) {
  const seed = hash(`rating|${name}`);
  const jitter = ((seed % 20) - 10) / 20;
  const base = Math.max(2.5, Math.min(5, 2.8 + signal / 1.5 + jitter));
  return Math.round(base * 10) / 10;
}

function main() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Source file not found: ${SOURCE}`);
  }
  const wb = XLSX.readFile(SOURCE);

  const salesRows = readSheet(wb, "Sales Team");
  const engRows = readSheet(wb, "Engineering");
  const hrRows = readSheet(wb, "HR team");

  const payrollDate = new Date(2026, 2, 5);
  const payroll: Row[] = [];

  salesRows.forEach((r, i) => {
    const name = String(r["Rep_Name"]);
    const region = r["Region"] ? String(r["Region"]) : undefined;
    const revenue = Number(r["Revenue_Generated"] ?? 0);
    const deals = Number(r["Deals_Closed"] ?? 0);
    const salary = seededSalary(name, "Sales", region);
    const bonus = seededBonus(name, salary);
    const perfSignal = Math.min(revenue / 15000 + deals * 0.2, 2.5);
    payroll.push({
      Employee_ID: `EMP-S${String(i + 1).padStart(3, "0")}`,
      Employee_Name: name,
      Department: "Sales",
      Salary: salary,
      Bonus: bonus,
      Overtime_Hours: (hash(name) % 12) + 0,
      Performance_Rating: seededRating(name, perfSignal),
      Payroll_Date: payrollDate,
    });
  });

  engRows.forEach((r, i) => {
    const name = String(r["Engineer_Name"]);
    const perfScore = Number(r["Performance_Score"] ?? 80);
    const salary = seededSalary(name, "Engineering");
    const bonus = seededBonus(name, salary);
    const perfSignal = (perfScore - 80) / 10;
    payroll.push({
      Employee_ID: `EMP-E${String(i + 1).padStart(3, "0")}`,
      Employee_Name: name,
      Department: "Engineering",
      Salary: salary,
      Bonus: bonus,
      Overtime_Hours: (hash(`ot|${name}`) % 15) + 0,
      Performance_Rating: seededRating(name, perfSignal),
      Payroll_Date: payrollDate,
    });
  });

  const seenHR = new Set<string>();
  for (const r of hrRows) {
    const name = r["Employee_Name"] ? String(r["Employee_Name"]) : "";
    if (!name || seenHR.has(name)) continue;
    seenHR.add(name);
    const salary = 70000 + (hash(name) % 18000);
    payroll.push({
      Employee_ID: `EMP-H${String(seenHR.size).padStart(3, "0")}`,
      Employee_Name: name,
      Department: "HR",
      Salary: salary,
      Bonus: seededBonus(name, salary),
      Overtime_Hours: (hash(`ot|${name}`) % 8) + 0,
      Performance_Rating: seededRating(name, 0),
      Payroll_Date: payrollDate,
    });
  }

  const newWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(newWb, wb.Sheets["Sales Team"], "Sales Team");
  XLSX.utils.book_append_sheet(newWb, wb.Sheets["Engineering"], "Engineering");
  XLSX.utils.book_append_sheet(
    newWb,
    XLSX.utils.json_to_sheet(payroll, {
      header: [
        "Employee_ID",
        "Employee_Name",
        "Department",
        "Salary",
        "Bonus",
        "Overtime_Hours",
        "Performance_Rating",
        "Payroll_Date",
      ],
    }),
    "Payroll data",
  );
  XLSX.utils.book_append_sheet(newWb, wb.Sheets["HR team"], "HR team");

  fs.mkdirSync(OUT_DIR, { recursive: true });
  XLSX.writeFile(newWb, OUT);

  const salesNames = new Set(salesRows.map((r) => String(r["Rep_Name"])));
  const engNames = new Set(engRows.map((r) => String(r["Engineer_Name"])));
  const payrollNames = new Set(payroll.map((r) => String(r["Employee_Name"])));

  const salesUnjoined = [...salesNames].filter((n) => !payrollNames.has(n));
  const engUnjoined = [...engNames].filter((n) => !payrollNames.has(n));

  console.log(`Wrote ${OUT}`);
  console.log(
    `Sales: ${salesNames.size} reps, ${salesNames.size - salesUnjoined.length} joined to Payroll`,
  );
  console.log(
    `Engineering: ${engNames.size} engineers, ${engNames.size - engUnjoined.length} joined to Payroll`,
  );
  console.log(`HR: ${seenHR.size} unique names in Payroll`);
  if (salesUnjoined.length || engUnjoined.length) {
    console.error("Unjoined names — regeneration failed");
    console.error({ salesUnjoined, engUnjoined });
    process.exit(1);
  }
}

main();
