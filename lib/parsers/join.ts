import { employeeKey, normalizeName } from "@/lib/utils";
import type { EmployeeRecord, HRActivity, Priority } from "@/lib/types";

import type { WorkbookParse } from "./xlsx";
import type {
  EngineeringRow,
  HRActivityRow,
  HRCompensationRow,
  HRTeamShortRow,
  PayrollRow,
  SalesTeamRow,
} from "./schema";

export type JoinResult = {
  employees: EmployeeRecord[];
  unjoined_names: string[];
  date_range: { from: string; to: string };
};

function earliest(a: string | null | undefined, b: string) {
  if (!a) return b;
  return a < b ? a : b;
}
function latest(a: string | null | undefined, b: string) {
  if (!a) return b;
  return a > b ? a : b;
}

function aggregateSalesRows(rows: SalesTeamRow[]) {
  const grouped = new Map<string, SalesTeamRow[]>();
  for (const r of rows) {
    const key = normalizeName(r.Rep_Name);
    const bucket = grouped.get(key) ?? [];
    bucket.push(r);
    grouped.set(key, bucket);
  }
  const out: Array<{
    name: string;
    rep_id: string;
    region: string | null;
    signals: Record<string, number>;
    date_from: string;
    date_to: string;
  }> = [];
  for (const [, list] of grouped) {
    const first = list[0];
    const date_from = list.reduce<string>(
      (acc, r) => (acc && acc < r.Activity_Date ? acc : r.Activity_Date),
      list[0].Activity_Date,
    );
    const date_to = list.reduce<string>(
      (acc, r) => (acc && acc > r.Activity_Date ? acc : r.Activity_Date),
      list[0].Activity_Date,
    );
    out.push({
      name: first.Rep_Name,
      rep_id: first.Rep_ID,
      region: first.Region ?? null,
      signals: {
        calls_made: sum(list, "Calls_Made"),
        emails_sent: sum(list, "Emails_Sent"),
        meetings_booked: sum(list, "Meetings_Booked"),
        opportunities_created: sum(list, "Opportunities_Created"),
        deals_closed: sum(list, "Deals_Closed"),
        revenue_generated: sum(list, "Revenue_Generated"),
      },
      date_from,
      date_to,
    });
  }
  return out;
}

function aggregateEngineeringRows(rows: EngineeringRow[]) {
  const grouped = new Map<string, EngineeringRow[]>();
  for (const r of rows) {
    const key = normalizeName(r.Engineer_Name);
    const bucket = grouped.get(key) ?? [];
    bucket.push(r);
    grouped.set(key, bucket);
  }
  const out: Array<{
    name: string;
    engineer_id: string;
    signals: Record<string, number>;
    performance_score: number | null;
    date_from: string;
    date_to: string;
  }> = [];
  for (const [, list] of grouped) {
    const first = list[0];
    const date_from = list.reduce<string>(
      (acc, r) => (acc && acc < r.Activity_Date ? acc : r.Activity_Date),
      list[0].Activity_Date,
    );
    const date_to = list.reduce<string>(
      (acc, r) => (acc && acc > r.Activity_Date ? acc : r.Activity_Date),
      list[0].Activity_Date,
    );
    const perfScores = list
      .map((r) => r.Performance_Score)
      .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
    const performance_score =
      perfScores.length > 0
        ? perfScores.reduce((a, b) => a + b, 0) / perfScores.length
        : null;
    out.push({
      name: first.Engineer_Name,
      engineer_id: first.Engineer_ID,
      signals: {
        projects_assigned: sum(list, "Projects_Assigned"),
        tasks_completed: sum(list, "Tasks_Completed"),
        bugs_fixed: sum(list, "Bugs_Fixed"),
        code_commits: sum(list, "Code_Commits"),
        pull_requests: sum(list, "Pull_Requests"),
      },
      performance_score,
      date_from,
      date_to,
    });
  }
  return out;
}

function aggregateHRActivityRows(rows: HRActivityRow[]) {
  const grouped = new Map<string, HRActivityRow[]>();
  for (const r of rows) {
    const bucket = grouped.get(r.Employee_ID) ?? [];
    bucket.push(r);
    grouped.set(r.Employee_ID, bucket);
  }
  const out: Array<{
    employee_id: string;
    name: string;
    sub_department: string;
    job_title: string | null;
    activities: HRActivity[];
    signals: Record<string, number>;
    date_from: string;
    date_to: string;
  }> = [];
  for (const [employee_id, list] of grouped) {
    const first = list[0];
    const activities: HRActivity[] = list.map((r) => ({
      date: r.Activity_Date,
      type: r.Activity_Type ?? "",
      description: r.Activity_Description ?? "",
      duration_hours: r.Duration_Hours ?? 0,
      employees_impacted: r.Employees_Impacted ?? 0,
      priority: (r.Priority as Priority | null) ?? "Medium",
      status: r.Status ?? "",
    }));
    const date_from = activities.reduce(
      (acc, a) => (acc < a.date ? acc : a.date),
      activities[0].date,
    );
    const date_to = activities.reduce(
      (acc, a) => (acc > a.date ? acc : a.date),
      activities[0].date,
    );
    out.push({
      employee_id,
      name: first.Employee_Name,
      sub_department: first.Department,
      job_title: first.Job_Title ?? null,
      activities,
      signals: {
        activity_count: activities.length,
        total_hours: activities.reduce((a, b) => a + b.duration_hours, 0),
        total_impacted: activities.reduce((a, b) => a + b.employees_impacted, 0),
        high_priority_count: activities.filter(
          (a) => a.priority === "High" || a.priority === "Critical",
        ).length,
        critical_priority_count: activities.filter((a) => a.priority === "Critical")
          .length,
      },
      date_from,
      date_to,
    });
  }
  return out;
}

function sum<T extends Record<string, unknown>>(list: T[], key: keyof T): number {
  return list.reduce((acc, row) => {
    const v = row[key];
    return typeof v === "number" && Number.isFinite(v) ? acc + v : acc;
  }, 0);
}

function findPayroll(
  payroll: PayrollRow[],
  name: string,
  department: string,
): PayrollRow | null {
  const nameKey = normalizeName(name);
  const deptKey = normalizeName(department);
  return (
    payroll.find(
      (p) =>
        normalizeName(p.Employee_Name) === nameKey &&
        normalizeName(p.Department) === deptKey,
    ) ?? null
  );
}

export function joinShapeA(parse: WorkbookParse): JoinResult {
  if (parse.shape !== "A") throw new Error("joinShapeA called on non-A shape");
  const { salesTeam = [], engineering = [], payroll = [], hrTeamShort = [] } =
    parse.rows;

  const employees: EmployeeRecord[] = [];
  const unjoined: string[] = [];
  let globalFrom = "";
  let globalTo = "";

  const markRange = (from: string, to: string) => {
    globalFrom = earliest(globalFrom || null, from);
    globalTo = latest(globalTo || null, to);
  };

  for (const s of aggregateSalesRows(salesTeam)) {
    const pay = findPayroll(payroll, s.name, "Sales");
    if (!pay) unjoined.push(s.name);
    const key = employeeKey(s.name, "Sales");
    markRange(s.date_from, s.date_to);
    employees.push({
      employee_key: key,
      source_ids: { activity_id: s.rep_id, payroll_id: pay?.Employee_ID ?? null },
      name: s.name,
      department: "Sales",
      sub_department: null,
      job_title: null,
      level: null,
      region: s.region,
      salary: pay?.Salary ?? null,
      bonus: pay?.Bonus ?? null,
      equity: null,
      total_cost_to_company:
        pay?.Salary != null ? pay.Salary + (pay.Bonus ?? 0) : null,
      overtime_hours: pay?.Overtime_Hours ?? null,
      hire_date: null,
      location: null,
      signals: s.signals,
      activities: null,
      existing_ratings: {
        performance_score: null,
        performance_rating: pay?.Performance_Rating ?? null,
      },
      computed: null,
      narrative: null,
      snapshot_date_range: { from: s.date_from, to: s.date_to },
    });
  }

  for (const e of aggregateEngineeringRows(engineering)) {
    const pay = findPayroll(payroll, e.name, "Engineering");
    if (!pay) unjoined.push(e.name);
    const key = employeeKey(e.name, "Engineering");
    markRange(e.date_from, e.date_to);
    employees.push({
      employee_key: key,
      source_ids: { activity_id: e.engineer_id, payroll_id: pay?.Employee_ID ?? null },
      name: e.name,
      department: "Engineering",
      sub_department: null,
      job_title: null,
      level: null,
      region: null,
      salary: pay?.Salary ?? null,
      bonus: pay?.Bonus ?? null,
      equity: null,
      total_cost_to_company:
        pay?.Salary != null ? pay.Salary + (pay.Bonus ?? 0) : null,
      overtime_hours: pay?.Overtime_Hours ?? null,
      hire_date: null,
      location: null,
      signals: e.signals,
      activities: null,
      existing_ratings: {
        performance_score: e.performance_score,
        performance_rating: pay?.Performance_Rating ?? null,
      },
      computed: null,
      narrative: null,
      snapshot_date_range: { from: e.date_from, to: e.date_to },
    });
  }

  // HR team short sheet: if present and Shape B hasn't supplied a richer HR,
  // produce lightweight HR employees.
  if (hrTeamShort.length > 0) {
    const grouped = new Map<string, HRTeamShortRow[]>();
    for (const r of hrTeamShort) {
      const bucket = grouped.get(r.Employee_ID) ?? [];
      bucket.push(r);
      grouped.set(r.Employee_ID, bucket);
    }
    for (const [, list] of grouped) {
      const first = list[0];
      const pay = findPayroll(payroll, first.Employee_Name, "HR");
      const key = employeeKey(first.Employee_Name, "HR");
      const date_from = list.reduce<string>(
        (acc, r) => (acc < r.Activity_Date ? acc : r.Activity_Date),
        list[0].Activity_Date,
      );
      const date_to = list.reduce<string>(
        (acc, r) => (acc > r.Activity_Date ? acc : r.Activity_Date),
        list[0].Activity_Date,
      );
      markRange(date_from, date_to);
      const activities: HRActivity[] = list.map((r) => ({
        date: r.Activity_Date,
        type: r.Activity_Type ?? "",
        description: r.Activity_Description ?? "",
        duration_hours: r.Duration_Hours ?? 0,
        employees_impacted: r.Employees_Impacted ?? 0,
        priority: "Medium",
        status: r.Status ?? "",
      }));
      employees.push({
        employee_key: key,
        source_ids: {
          activity_id: first.Employee_ID,
          payroll_id: pay?.Employee_ID ?? null,
        },
        name: first.Employee_Name,
        department: "HR",
        sub_department: null,
        job_title: null,
        level: null,
        region: null,
        salary: pay?.Salary ?? null,
        bonus: pay?.Bonus ?? null,
        equity: null,
        total_cost_to_company:
          pay?.Salary != null ? pay.Salary + (pay.Bonus ?? 0) : null,
        overtime_hours: pay?.Overtime_Hours ?? null,
        hire_date: null,
        location: null,
        signals: {
          activity_count: activities.length,
          total_hours: activities.reduce((a, b) => a + b.duration_hours, 0),
          total_impacted: activities.reduce((a, b) => a + b.employees_impacted, 0),
          high_priority_count: 0,
        },
        activities,
        existing_ratings: {
          performance_score: null,
          performance_rating: pay?.Performance_Rating ?? null,
        },
        computed: null,
        narrative: null,
        snapshot_date_range: { from: date_from, to: date_to },
      });
    }
  }

  return {
    employees,
    unjoined_names: unjoined,
    date_range: { from: globalFrom || "", to: globalTo || "" },
  };
}

export function joinShapeB(parse: WorkbookParse): JoinResult {
  if (parse.shape !== "B") throw new Error("joinShapeB called on non-B shape");
  const { hrActivity = [], hrCompensation = [] } = parse.rows;

  const compById = new Map<string, HRCompensationRow>();
  for (const c of hrCompensation) compById.set(c.Employee_ID, c);

  const employees: EmployeeRecord[] = [];
  const unjoined: string[] = [];
  let globalFrom = "";
  let globalTo = "";

  for (const r of aggregateHRActivityRows(hrActivity)) {
    const comp = compById.get(r.employee_id);
    if (!comp) unjoined.push(r.name);
    const key = employeeKey(r.name, "HR");
    globalFrom = earliest(globalFrom || null, r.date_from);
    globalTo = latest(globalTo || null, r.date_to);
    employees.push({
      employee_key: key,
      source_ids: {
        activity_id: r.employee_id,
        payroll_id: comp?.Employee_ID ?? null,
      },
      name: r.name,
      department: "HR",
      sub_department: r.sub_department,
      job_title: r.job_title ?? comp?.Job_Title ?? null,
      level: comp?.Level ?? null,
      region: null,
      salary: comp?.Annual_Base_Salary ?? null,
      bonus: comp?.Annual_Bonus_Target_Amt ?? null,
      equity: comp?.Annual_Equity_Grant ?? null,
      total_cost_to_company: comp?.Total_Cost_to_Company ?? null,
      overtime_hours: null,
      hire_date: comp?.Hire_Date ?? null,
      location: comp?.Location ?? null,
      signals: r.signals,
      activities: r.activities,
      existing_ratings: { performance_score: null, performance_rating: null },
      computed: null,
      narrative: null,
      snapshot_date_range: { from: r.date_from, to: r.date_to },
    });
  }

  return {
    employees,
    unjoined_names: unjoined,
    date_range: { from: globalFrom, to: globalTo },
  };
}
