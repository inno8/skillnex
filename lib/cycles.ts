/**
 * Cycle label helpers.
 *
 * Cycle labels are free text in the database — anything goes — but the
 * UX defaults to a specific format ("Q1 2026") so we can make smart
 * "next cycle" suggestions. These helpers parse the common shapes and
 * advance them; everything that doesn't parse falls back to the calendar
 * quarter for "now", which is right far more often than it's wrong.
 *
 * The DEFAULT_CYCLE_LABEL constant lives in lib/db (it's also the SQL
 * column default in migration 0007); we re-export it here so callers
 * have one place to import from.
 */
import { DEFAULT_CYCLE_LABEL } from "@/lib/db";

export { DEFAULT_CYCLE_LABEL };

/**
 * Best-effort label for "the cycle right now" — the calendar quarter.
 * January = Q1, April = Q2, etc.
 */
export function currentCalendarCycle(now = new Date()): string {
  const month = now.getMonth(); // 0-11
  const quarter = Math.floor(month / 3) + 1; // 1-4
  return `Q${quarter} ${now.getFullYear()}`;
}

/**
 * Next quarter after a previous label. Recognized formats:
 *   - "Q1 2026" / "q1 2026" / "Q1-2026" / "Q1/2026"  → "Q2 2026"
 *   - "Q4 2026" → "Q1 2027" (year rolls over)
 *   - "Annual 2025" → "Annual 2026"
 *   - anything else → fall back to the current calendar quarter
 */
export function suggestNextCycle(prev: string | null, now = new Date()): string {
  if (!prev) return currentCalendarCycle(now);
  const trimmed = prev.trim();

  const quarterMatch = trimmed.match(/^Q([1-4])[\s\-/]*(\d{4})$/i);
  if (quarterMatch) {
    let q = Number(quarterMatch[1]);
    let y = Number(quarterMatch[2]);
    q += 1;
    if (q > 4) {
      q = 1;
      y += 1;
    }
    return `Q${q} ${y}`;
  }

  const annualMatch = trimmed.match(/^(annual|year)[\s\-/]*(\d{4})$/i);
  if (annualMatch) {
    return `${annualMatch[1]} ${Number(annualMatch[2]) + 1}`;
  }

  return currentCalendarCycle(now);
}
