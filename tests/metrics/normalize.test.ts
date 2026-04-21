import { describe, expect, it } from "vitest";

import { normalize, rankDescending } from "@/lib/metrics/normalize";

describe("normalize", () => {
  it("throws on empty array", () => {
    expect(() => normalize([])).toThrow(/empty/);
  });

  it("returns [50] for single value", () => {
    expect(normalize([100])).toEqual([50]);
  });

  it("returns all 50 when all values equal", () => {
    expect(normalize([7, 7, 7])).toEqual([50, 50, 50]);
  });

  it("maps min to 0 and max to 100", () => {
    const [a, b, c] = normalize([10, 20, 30]);
    expect(a).toBe(0);
    expect(b).toBe(50);
    expect(c).toBe(100);
  });

  it("handles negative and fractional values", () => {
    expect(normalize([-10, 0, 10])).toEqual([0, 50, 100]);
  });
});

describe("rankDescending", () => {
  it("assigns 0 to largest", () => {
    expect(rankDescending([1, 3, 2])).toEqual([2, 0, 1]);
  });
  it("breaks ties by input index", () => {
    expect(rankDescending([5, 5, 5])).toEqual([0, 1, 2]);
  });
});
