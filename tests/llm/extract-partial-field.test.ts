import { describe, expect, it } from "vitest";

import { extractPartialField } from "@/lib/llm/client";

/**
 * extractPartialField is the helper that pulls `review_paragraph` out of
 * the partial JSON Anthropic streams via input_json_delta events. Hand-
 * rolled because we want it to NEVER throw — partial input must always
 * produce "longest readable prefix or null", because we hit it on every
 * delta tick.
 */

describe("extractPartialField", () => {
  it("returns null when the field key isn't in the buffer yet", () => {
    expect(extractPartialField("", "review_paragraph")).toBeNull();
    expect(extractPartialField('{"summary":"hello"', "review_paragraph")).toBeNull();
  });

  it("returns the partial value while the value is still streaming", () => {
    const partial = '{"review_paragraph":"Alice ranked 1';
    expect(extractPartialField(partial, "review_paragraph")).toBe("Alice ranked 1");
  });

  it("returns the full value once the closing quote arrives", () => {
    const full = '{"review_paragraph":"Alice ranked 1 of 5."';
    expect(extractPartialField(full, "review_paragraph")).toBe("Alice ranked 1 of 5.");
  });

  it('handles \\n, \\t, \\r, \\\\, \\", \\/ escapes', () => {
    const json =
      '{"review_paragraph":"Line one\\nLine two\\tindented \\\\back \\"quote\\" and \\/slash"';
    expect(extractPartialField(json, "review_paragraph")).toBe(
      'Line one\nLine two\tindented \\back "quote" and /slash',
    );
  });

  it("handles \\uXXXX unicode escapes", () => {
    // é = é
    const json = '{"review_paragraph":"caf\\u00e9"';
    expect(extractPartialField(json, "review_paragraph")).toBe("café");
  });

  it("stops at incomplete escape sequences (don't crash, don't over-emit)", () => {
    // Buffer ends mid-escape — yield what we have so far, ignore the dangling \
    expect(extractPartialField('{"review_paragraph":"Alice\\', "review_paragraph")).toBe("Alice");
    expect(extractPartialField('{"review_paragraph":"Alice\\u00', "review_paragraph")).toBe(
      "Alice",
    );
  });

  it("ignores other fields in the JSON", () => {
    const json =
      '{"summary":"sum","strengths":["a","b"],"review_paragraph":"the para","watch_items":[]}';
    expect(extractPartialField(json, "review_paragraph")).toBe("the para");
  });

  it("works mid-stream when other fields stream first", () => {
    // tool_use input arrives one field at a time; partial JSON looks like
    // this when the model has just opened the review_paragraph value:
    const buf = '{"summary":"Alice ranked 1 of 5","review_paragraph":"';
    expect(extractPartialField(buf, "review_paragraph")).toBe("");
  });

  it("returns null for unrelated fields", () => {
    const json = '{"review_paragraph":"para"}';
    expect(extractPartialField(json, "summary")).toBeNull();
  });
});
