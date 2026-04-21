/**
 * Shared types for Skillnex. See PLAN.md §4 for rationale.
 */

export type Department = "Sales" | "Engineering" | "HR" | string;

export type Priority = "Critical" | "High" | "Medium" | "Low";

export type HRActivity = {
  date: string;
  type: string;
  description: string;
  duration_hours: number;
  employees_impacted: number;
  priority: Priority;
  status: string;
};

export type ExistingRatings = {
  performance_score: number | null;
  performance_rating: number | null;
};

export type ComputedMetrics = {
  value_score: number;
  roi: number | null;
  cost_efficiency: number | null;
  dept_rank: number;
  dept_size: number;
  breakdown: Record<string, number>;
};

export type NarrativeOutput = {
  summary: string;
  strengths: string[];
  watch_items: string[];
  review_paragraph: string;
};

export type EmployeeRecord = {
  employee_key: string;
  source_ids: {
    activity_id: string;
    payroll_id: string | null;
  };
  name: string;
  department: Department;
  sub_department: string | null;
  job_title: string | null;
  level: string | null;
  region: string | null;
  salary: number | null;
  bonus: number | null;
  equity: number | null;
  total_cost_to_company: number | null;
  overtime_hours: number | null;
  hire_date: string | null;
  location: string | null;
  signals: Record<string, number>;
  activities: HRActivity[] | null;
  existing_ratings: ExistingRatings;
  computed: ComputedMetrics | null;
  narrative: NarrativeOutput | null;
  snapshot_date_range: { from: string; to: string };
};

export type ParseResult = {
  shape: "A" | "B";
  employees: EmployeeRecord[];
  unjoined_names: string[];
  row_counts: Record<string, number>;
  date_range: { from: string; to: string };
};
