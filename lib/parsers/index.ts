import type { ParseResult } from "@/lib/types";

import { joinShapeA, joinShapeB } from "./join";
import { ParseError, parseWorkbook } from "./xlsx";

export { ParseError } from "./xlsx";
export type { ParseResult } from "@/lib/types";

export function parseSkillnexWorkbook(
  buffer: ArrayBuffer | Uint8Array | Buffer,
): ParseResult {
  const parsed = parseWorkbook(buffer);
  const joined =
    parsed.shape === "A" ? joinShapeA(parsed) : joinShapeB(parsed);
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
