/**
 * Shape C — flexible parser for "we don't know the schema" data.
 *
 * Pilot reality: customers don't structure their HR exports the way
 * Shape A (Sales/Engineering/Payroll) or Shape B (HR Activity Log +
 * Compensation) expect. A healthcare company has nurses; a law firm
 * has paralegals. Their xlsx will have a name column, a department
 * column, and then *whatever signals their HRIS exports* — task counts,
 * billable hours, qualitative ratings, anything.
 *
 * Shape C is the catch-all. It:
 *   1. Fuzzy-matches name + department from the column headers
 *   2. Aggregates multi-row-per-employee data (one row per day) into
 *      per-employee summaries
 *   3. Maps qualitative text ratings ("Excellent", "Good") onto the
 *      same 1-5 numeric scale we already use for performance_rating
 *   4. Treats every other numeric column as an opaque "signal" so the
 *      narrative LLM and fallback metric still have something to talk
 *      about, even without a Sales/Engineering-specific schema
 *
 * Anything we couldn't make sense of is returned as a `warning` so the
 * UI can tell the user "we mapped X, ignored Y" — pilot users hated
 * silent data loss in the previous iteration.
 */

import { employeeKey } from "@/lib/utils";
import type { EmployeeRecord } from "@/lib/types";

/* ---------------------------------------------------------------- *
 * Column dictionaries — synonyms we accept for each canonical field.
 * Match is case-insensitive AND ignores whitespace / underscores /
 * dashes, so "Employee Name", "employee_name", "Employee-Name", and
 * "EMPLOYEENAME" all collapse to "employeename".
 * ---------------------------------------------------------------- */

const NAME_SYNONYMS = [
  "name",
  "fullname",
  "employeename",
  "empname",
  "repname",
  "engineername",
  "person",
  "personname",
  "staffname",
];

const ID_SYNONYMS = ["id", "employeeid", "empid", "personid", "staffid", "repid", "engineerid"];

const DEPARTMENT_SYNONYMS = [
  "department",
  "dept",
  "team",
  "division",
  "businessunit",
  "bu",
  "function",
  "practice",
];

const EMAIL_SYNONYMS = ["email", "emailaddress", "workemail", "mail"];

const TITLE_SYNONYMS = ["jobtitle", "title", "position", "role"];

const LEVEL_SYNONYMS = ["level", "grade", "tier", "band", "seniority"];

const SALARY_SYNONYMS = [
  "salary",
  "annualbasesalary",
  "basesalary",
  "annualsalary",
  "basepay",
  "compensation",
];

const LOCATION_SYNONYMS = ["location", "office", "city", "site"];

const RATING_SYNONYMS = [
  "performancerating",
  "rating",
  "overallrating",
  "managerrating",
  "ratingoverall",
];

const SCORE_SYNONYMS = ["performancescore", "score", "overallscore", "ratingscore"];

const DATE_SYNONYMS = ["date", "day", "activitydate", "workdate", "logdate"];

/* ---------------------------------------------------------------- *
 * Qualitative rating bucket — text → 1–5 numeric.
 *
 * Order matters: "needsimprovement" must be checked before "needs"
 * (which appears in plenty of other phrases). We do whole-string
 * inclusion checks against the lowercased value, so the longer
 * patterns are matched first.
 * ---------------------------------------------------------------- */

const RATING_BUCKETS: Array<[RegExp | string, number]> = [
  [/exceptional|outstanding|exceeds.*expectation/i, 5],
  ["excellent", 5],
  ["very good", 4.5],
  [/meets.*expectation|satisfactory/i, 3.5],
  ["good", 4],
  ["average", 3],
  ["fair", 3],
  [/needs.*improve|below.*expectation/i, 2],
  [/poor|unsatisfactory/i, 1],
];

/* ---------------------------------------------------------------- */

function normKey(k: string): string {
  return k.toLowerCase().replace(/[\s_\-]+/g, "");
}

function findColumn(headers: string[], synonyms: string[]): string | null {
  const normalized = headers.map((h) => [h, normKey(h)] as const);
  for (const synonym of synonyms) {
    const target = normKey(synonym);
    for (const [original, norm] of normalized) {
      if (norm === target) return original;
    }
  }
  // Fallback: substring match for slightly-different phrasings (e.g.
  // "first_name" → name). Only the canonical short synonyms are checked
  // as substrings to avoid false positives like "team_lead" matching "team".
  for (const synonym of synonyms.slice(0, 3)) {
    const target = normKey(synonym);
    for (const [original, norm] of normalized) {
      if (norm.includes(target)) return original;
    }
  }
  return null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[$,\s]/g, "");
    const n = Number(cleaned);
    if (!Number.isNaN(n) && Number.isFinite(n)) return n;
  }
  return null;
}

function asRating(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = asNumber(v);
  if (n != null) {
    // If it's already 0–5 numeric, keep it. If it's 0–100 (a percentage
    // score), rescale to /5 so existing_ratings.performance_rating stays
    // on a single scale.
    if (n >= 0 && n <= 5) return n;
    if (n >= 0 && n <= 100) return Math.round((n / 100) * 5 * 10) / 10;
    return null;
  }
  if (typeof v === "string") {
    const lower = v.trim().toLowerCase();
    if (!lower) return null;
    for (const [pattern, score] of RATING_BUCKETS) {
      if (pattern instanceof RegExp ? pattern.test(lower) : lower.includes(pattern)) {
        return score;
      }
    }
  }
  return null;
}

/* ---------------------------------------------------------------- *
 * Detect numeric "signal" columns — anything that:
 *   - Has at least one numeric value across the rows
 *   - Isn't a known meta column (name, dept, salary, date, rating, …)
 * ---------------------------------------------------------------- */

function isMetaColumn(col: string, mapping: ColumnMapping): boolean {
  return (
    col === mapping.name ||
    col === mapping.id ||
    col === mapping.department ||
    col === mapping.email ||
    col === mapping.title ||
    col === mapping.level ||
    col === mapping.salary ||
    col === mapping.location ||
    col === mapping.rating ||
    col === mapping.score ||
    col === mapping.date
  );
}

function detectNumericColumns(rows: Record<string, unknown>[], mapping: ColumnMapping): string[] {
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0]);
  const numericCols: string[] = [];
  for (const col of headers) {
    if (isMetaColumn(col, mapping)) continue;
    let numericHits = 0;
    let totalNonEmpty = 0;
    for (const row of rows) {
      const v = row[col];
      if (v == null || v === "") continue;
      totalNonEmpty += 1;
      if (asNumber(v) != null) numericHits += 1;
    }
    // Treat as numeric if at least 70% of non-empty values parse as
    // numbers. Avoids ID-like strings tripping the detector.
    if (totalNonEmpty > 0 && numericHits / totalNonEmpty >= 0.7) {
      numericCols.push(col);
    }
  }
  return numericCols;
}

function detectRatingColumns(
  rows: Record<string, unknown>[],
  mapping: ColumnMapping,
  numericCols: string[],
): string[] {
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0]);
  const ratingCols: string[] = [];
  for (const col of headers) {
    if (isMetaColumn(col, mapping)) continue;
    if (numericCols.includes(col)) continue;
    let ratingHits = 0;
    let totalNonEmpty = 0;
    for (const row of rows) {
      const v = row[col];
      if (v == null || v === "") continue;
      totalNonEmpty += 1;
      if (asRating(v) != null) ratingHits += 1;
    }
    if (totalNonEmpty > 0 && ratingHits / totalNonEmpty >= 0.7) {
      ratingCols.push(col);
    }
  }
  return ratingCols;
}

/* ---------------------------------------------------------------- */

type ColumnMapping = {
  name: string | null;
  id: string | null;
  department: string | null;
  email: string | null;
  title: string | null;
  level: string | null;
  salary: string | null;
  location: string | null;
  rating: string | null;
  score: string | null;
  date: string | null;
};

export type FlexibleParseResult = {
  employees: EmployeeRecord[];
  warnings: string[];
  detected: {
    name: string | null;
    department: string | null;
    signal_columns: string[];
    rating_columns: string[];
    aggregated_rows: number;
    raw_row_count: number;
  };
};

/**
 * Parse a single sheet's raw rows into per-employee EmployeeRecords.
 * Caller is responsible for providing the rows already filtered to a
 * single tab via XLSX.utils.sheet_to_json().
 */
export function parseFlexibleSheet(
  rows: Record<string, unknown>[],
  opts: { sheetName: string; tenant_default_dept?: string } = {
    sheetName: "Sheet1",
  },
): FlexibleParseResult {
  if (rows.length === 0) {
    throw new FlexibleParseError(
      `Sheet "${opts.sheetName}" is empty. Add some rows or pick a different sheet.`,
    );
  }

  const headers = Object.keys(rows[0]);
  const mapping: ColumnMapping = {
    name: findColumn(headers, NAME_SYNONYMS),
    id: findColumn(headers, ID_SYNONYMS),
    department: findColumn(headers, DEPARTMENT_SYNONYMS),
    email: findColumn(headers, EMAIL_SYNONYMS),
    title: findColumn(headers, TITLE_SYNONYMS),
    level: findColumn(headers, LEVEL_SYNONYMS),
    salary: findColumn(headers, SALARY_SYNONYMS),
    location: findColumn(headers, LOCATION_SYNONYMS),
    rating: findColumn(headers, RATING_SYNONYMS),
    score: findColumn(headers, SCORE_SYNONYMS),
    date: findColumn(headers, DATE_SYNONYMS),
  };

  if (!mapping.name) {
    throw new FlexibleParseError(
      `Couldn't find a name column in "${opts.sheetName}". ` +
        `Looked for any of: ${NAME_SYNONYMS.join(", ")}. ` +
        `Found columns: ${headers.join(", ")}`,
    );
  }

  const warnings: string[] = [];
  if (!mapping.department) {
    warnings.push(
      `No department column found — using "${opts.tenant_default_dept ?? "Unspecified"}" for all employees. ` +
        `Add a "Department" column to break out scoring per team.`,
    );
  }

  const numericCols = detectNumericColumns(rows, mapping);
  const ratingCols = detectRatingColumns(rows, mapping, numericCols);
  const defaultDept = opts.tenant_default_dept ?? "Unspecified";

  /* ---- Group rows by (name, department) ---- */

  type Bucket = {
    name: string;
    id: string | null;
    department: string;
    title: string | null;
    level: string | null;
    email: string | null;
    location: string | null;
    salary: number | null;
    sums: Record<string, number>;
    counts: Record<string, number>;
    ratingValues: number[];
    qualitativeRatings: Record<string, number[]>;
    rowCount: number;
    dates: string[];
  };

  const buckets = new Map<string, Bucket>();

  for (const row of rows) {
    const rawName = row[mapping.name] as unknown;
    if (rawName == null || rawName === "") continue;
    const name = String(rawName).trim();
    if (!name) continue;

    const dept = mapping.department
      ? String(row[mapping.department] ?? defaultDept).trim() || defaultDept
      : defaultDept;

    const key = employeeKey(name, dept);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        name,
        id: mapping.id ? toStringOrNull(row[mapping.id]) : null,
        department: dept,
        title: mapping.title ? toStringOrNull(row[mapping.title]) : null,
        level: mapping.level ? toStringOrNull(row[mapping.level]) : null,
        email: mapping.email ? toEmailOrNull(row[mapping.email]) : null,
        location: mapping.location ? toStringOrNull(row[mapping.location]) : null,
        salary: mapping.salary ? asNumber(row[mapping.salary]) : null,
        sums: {},
        counts: {},
        ratingValues: [],
        qualitativeRatings: {},
        rowCount: 0,
        dates: [],
      };
      for (const col of numericCols) {
        bucket.sums[col] = 0;
        bucket.counts[col] = 0;
      }
      for (const col of ratingCols) {
        bucket.qualitativeRatings[col] = [];
      }
      buckets.set(key, bucket);
    }

    bucket.rowCount += 1;

    if (mapping.date) {
      const d = toIsoDateOrNull(row[mapping.date]);
      if (d) bucket.dates.push(d);
    }

    for (const col of numericCols) {
      const n = asNumber(row[col]);
      if (n != null) {
        bucket.sums[col] = (bucket.sums[col] ?? 0) + n;
        bucket.counts[col] = (bucket.counts[col] ?? 0) + 1;
      }
    }

    if (mapping.rating) {
      const r = asRating(row[mapping.rating]);
      if (r != null) bucket.ratingValues.push(r);
    }

    for (const col of ratingCols) {
      const r = asRating(row[col]);
      if (r != null) bucket.qualitativeRatings[col].push(r);
    }

    // First non-null per-bucket meta values "win" — most files have
    // them duplicated across rows, but we don't want to overwrite a
    // populated value with a later blank cell.
    if (!bucket.email && mapping.email) {
      bucket.email = toEmailOrNull(row[mapping.email]);
    }
    if (!bucket.title && mapping.title) {
      bucket.title = toStringOrNull(row[mapping.title]);
    }
    if (bucket.salary == null && mapping.salary) {
      bucket.salary = asNumber(row[mapping.salary]);
    }
  }

  /* ---- Bucket → EmployeeRecord ---- */

  const employees: EmployeeRecord[] = [];
  for (const bucket of buckets.values()) {
    // Numeric signals: average daily values when we aggregated multiple
    // rows per employee (typical for daily activity logs); leave one-row
    // employees as-is. Sum-vs-average is a real product call but average
    // is the safer default — summing daily counts inflates them by the
    // number of days and would dwarf a single-row employee's signals.
    const signals: Record<string, number> = {};
    for (const col of numericCols) {
      const count = bucket.counts[col] ?? 0;
      if (count === 0) continue;
      const average = (bucket.sums[col] ?? 0) / count;
      signals[normalizeSignalName(col)] = round2(average);
    }
    if (mapping.date && bucket.dates.length > 0) {
      signals.activity_count = bucket.rowCount;
    }

    // Existing ratings: prefer an explicit "rating" column, then fall
    // back to averaging the qualitative columns we bucketed.
    let performance_rating: number | null = null;
    if (bucket.ratingValues.length > 0) {
      performance_rating =
        bucket.ratingValues.reduce((a, b) => a + b, 0) / bucket.ratingValues.length;
    } else if (Object.keys(bucket.qualitativeRatings).length > 0) {
      const flat = Object.values(bucket.qualitativeRatings).flat();
      if (flat.length > 0) {
        performance_rating = flat.reduce((a, b) => a + b, 0) / flat.length;
      }
    }

    const dates = bucket.dates.length > 0 ? bucket.dates.sort() : null;
    const today = new Date().toISOString().slice(0, 10);

    employees.push({
      employee_key: employeeKey(bucket.name, bucket.department),
      source_ids: { activity_id: bucket.id ?? bucket.name, payroll_id: null },
      name: bucket.name,
      email: bucket.email,
      department: bucket.department,
      sub_department: null,
      job_title: bucket.title,
      level: bucket.level,
      region: null,
      salary: bucket.salary,
      bonus: null,
      equity: null,
      total_cost_to_company: null,
      overtime_hours: null,
      hire_date: null,
      location: bucket.location,
      signals,
      activities: null,
      existing_ratings: {
        performance_score: null,
        performance_rating:
          performance_rating != null ? Math.round(performance_rating * 10) / 10 : null,
      },
      computed: null,
      narrative: null,
      snapshot_date_range: {
        from: dates?.[0] ?? today,
        to: dates?.[dates.length - 1] ?? today,
      },
    });
  }

  if (employees.length === 0) {
    throw new FlexibleParseError(
      `No employees produced from "${opts.sheetName}". Check that the name column has values.`,
    );
  }

  if (numericCols.length === 0 && ratingCols.length === 0 && !mapping.salary) {
    warnings.push(
      `No numeric or rating columns found — value scoring will be limited. ` +
        `Skillnex works best with at least one signal column (deals closed, hours worked, tasks completed, etc.) or a rating column.`,
    );
  }

  return {
    employees,
    warnings,
    detected: {
      name: mapping.name,
      department: mapping.department,
      signal_columns: numericCols,
      rating_columns: ratingCols,
      aggregated_rows: rows.length,
      raw_row_count: rows.length,
    },
  };
}

export class FlexibleParseError extends Error {
  constructor(
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "FlexibleParseError";
  }
}

/* ---- helpers ---- */

function toStringOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function toEmailOrNull(v: unknown): string | null {
  const s = toStringOrNull(v);
  if (!s) return null;
  const lower = s.toLowerCase();
  // Lazy email check — full RFC validation isn't worth it here; the
  // share-review modal will validate before actually sending.
  if (!lower.includes("@") || !lower.includes(".")) return null;
  return lower;
}

function toIsoDateOrNull(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string" && v.trim()) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Normalize "PrimaryActivity" / "Tasks Completed" / "Hours_Worked" → "tasks_completed". */
function normalizeSignalName(col: string): string {
  return col
    .replace(/[\s\-]+/g, "_")
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}
