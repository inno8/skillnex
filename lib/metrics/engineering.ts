import type { EmployeeRecord } from "@/lib/types";

import { ENGINEERING_WEIGHTS } from "./config";

export function engineeringRawValue(signals: Record<string, number>): {
  raw: number;
  breakdown: Record<string, number>;
} {
  const tasks = (signals.tasks_completed ?? 0) * ENGINEERING_WEIGHTS.tasks_completed;
  const bugs = (signals.bugs_fixed ?? 0) * ENGINEERING_WEIGHTS.bugs_fixed;
  const prs = (signals.pull_requests ?? 0) * ENGINEERING_WEIGHTS.pull_requests;
  const commits = (signals.code_commits ?? 0) * ENGINEERING_WEIGHTS.code_commits;
  const projects =
    (signals.projects_assigned ?? 0) * ENGINEERING_WEIGHTS.projects_assigned;
  const raw = tasks + bugs + prs + commits + projects;
  return {
    raw,
    breakdown: {
      tasks,
      bugs,
      pull_requests: prs,
      commits,
      projects,
    },
  };
}

export function engineeringRoi(
  employee: EmployeeRecord,
  rawValue: number,
): number | null {
  if (employee.salary == null || employee.salary <= 0) return null;
  return rawValue / employee.salary;
}
