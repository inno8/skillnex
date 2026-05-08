import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import { MultiSheetPickError, parseSkillnexWorkbook } from "@/lib/parsers";

/**
 * Build an in-memory xlsx buffer for testing — keeps the tests
 * hermetic (no fixture files on disk to drift from real customer data).
 */
function makeXlsx(sheets: Record<string, Record<string, unknown>[]>): Buffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("Shape C — flexible parser", () => {
  it("CSV → single-sheet flexible parse", () => {
    const csv = Buffer.from(
      "Name,Department,Tasks,Rating\n" +
        "Alice,Healthcare,40,Excellent\n" +
        "Bob,Healthcare,30,Good\n",
    );
    const r = parseSkillnexWorkbook(csv);
    expect(r.shape).toBe("C");
    expect(r.employees).toHaveLength(2);
    expect(r.employees[0].name).toBe("Alice");
    expect(r.employees[0].department).toBe("Healthcare");
    expect(r.employees[0].existing_ratings.performance_rating).toBe(5);
    expect(r.employees[0].signals.tasks).toBe(40);
  });

  it("multi-row-per-employee xlsx aggregates by averaging numeric columns", () => {
    const buf = makeXlsx({
      "Daily Activity": [
        { Name: "Alice", Department: "IT", Hours: 8, Tasks: 5 },
        { Name: "Alice", Department: "IT", Hours: 10, Tasks: 7 },
        { Name: "Bob", Department: "IT", Hours: 6, Tasks: 3 },
      ],
    });
    const r = parseSkillnexWorkbook(buf);
    expect(r.shape).toBe("C");
    expect(r.employees).toHaveLength(2);
    const alice = r.employees.find((e) => e.name === "Alice");
    expect(alice?.signals.hours).toBe(9); // (8+10)/2
    expect(alice?.signals.tasks).toBe(6);
  });

  it("maps qualitative ratings (Excellent/Good/...) onto the 1-5 numeric scale", () => {
    const csv = Buffer.from(
      "Name,Department,OverallRating\n" +
        "Alice,IT,Excellent\n" +
        "Bob,IT,Good\n" +
        "Carol,IT,Average\n" +
        "Dan,IT,Needs Improvement\n" +
        "Eve,IT,Poor\n",
    );
    const r = parseSkillnexWorkbook(csv);
    const ratingFor = (name: string) =>
      r.employees.find((e) => e.name === name)?.existing_ratings.performance_rating;
    expect(ratingFor("Alice")).toBe(5);
    expect(ratingFor("Bob")).toBe(4);
    expect(ratingFor("Carol")).toBe(3);
    expect(ratingFor("Dan")).toBe(2);
    expect(ratingFor("Eve")).toBe(1);
  });

  it("multi-sheet workbook with no Shape A/B match throws MultiSheetPickError", () => {
    const buf = makeXlsx({
      "Sheet One": [{ Name: "Alice", Department: "IT" }],
      "Sheet Two": [{ Name: "Bob", Department: "IT" }],
    });
    expect(() => parseSkillnexWorkbook(buf)).toThrow(MultiSheetPickError);
    try {
      parseSkillnexWorkbook(buf);
    } catch (e) {
      expect(e).toBeInstanceOf(MultiSheetPickError);
      expect((e as MultiSheetPickError).sheets).toEqual(["Sheet One", "Sheet Two"]);
    }
  });

  it("sheetHint locks onto a specific tab and runs Shape C", () => {
    const buf = makeXlsx({
      "Daily Activity": [{ Name: "Alice", Department: "IT", Tasks: 5 }],
      "Performance Review": [{ Name: "Bob", Department: "IT", OverallRating: "Good" }],
    });
    const r = parseSkillnexWorkbook(buf, { sheetHint: "Performance Review" });
    expect(r.shape).toBe("C");
    expect(r.employees).toHaveLength(1);
    expect(r.employees[0].name).toBe("Bob");
    expect(r.employees[0].existing_ratings.performance_rating).toBe(4);
  });

  it("respects the same Shape C path for the actual rejected pilot dataset shape", () => {
    // Mirrors the structure of the file a pilot tester uploaded that
    // initially got rejected: an IT Support roster with daily activity
    // and qualitative review columns.
    const buf = makeXlsx({
      "Daily Activity": [
        {
          EmployeeID: "E001",
          Name: "Employee_1",
          Department: "IT Support",
          Day: "Day_1",
          PrimaryActivity: "Documentation",
          HoursWorked: 8,
          TasksCompleted: 7,
        },
        {
          EmployeeID: "E001",
          Name: "Employee_1",
          Department: "IT Support",
          Day: "Day_2",
          PrimaryActivity: "Support",
          HoursWorked: 8,
          TasksCompleted: 5,
        },
      ],
      "Performance Review": [
        {
          EmployeeID: "E001",
          Name: "Employee_1",
          Department: "IT Support",
          OverallRating: "Good",
        },
      ],
    });
    const daily = parseSkillnexWorkbook(buf, { sheetHint: "Daily Activity" });
    expect(daily.shape).toBe("C");
    expect(daily.employees).toHaveLength(1);
    expect(daily.employees[0].department).toBe("IT Support");
    expect(daily.employees[0].signals.hours_worked).toBe(8);
    expect(daily.employees[0].signals.tasks_completed).toBe(6); // (7+5)/2
  });

  it("rejects sheets with no name column", () => {
    const csv = Buffer.from("Department,Tasks\nIT,5\n");
    expect(() => parseSkillnexWorkbook(csv)).toThrow(/name column/i);
  });

  it("uses 'Unspecified' default when no department column exists", () => {
    const csv = Buffer.from("Name,Tasks\nAlice,5\n");
    const r = parseSkillnexWorkbook(csv);
    expect(r.employees[0].department).toBe("Unspecified");
  });
});
