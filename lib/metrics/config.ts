/**
 * Opinionated starting weights. Editable per customer in phase 2.
 * See PLAN.md §5 for rationale.
 */
export const SALES_WEIGHTS = {
  revenue_generated: 1.0, // primary outcome
  deals_closed: 15000, // closing consistency bonus
  opportunities_created: 2000, // pipeline contribution
  meetings_booked: 300, // engagement signal
  // Calls_Made, Emails_Sent: tracked, not weighted — too easy to game.
};

export const ENGINEERING_WEIGHTS = {
  tasks_completed: 500,
  bugs_fixed: 1500,
  pull_requests: 2000,
  code_commits: 100,
  projects_assigned: 3000,
  // Performance_Score: NOT an input. Shown in comparison column.
};

export const HR_PRIORITY_WEIGHTS = {
  Critical: 2.0,
  High: 1.5,
  Medium: 1.0,
  Low: 0.5,
} as const;
