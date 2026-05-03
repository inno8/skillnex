import { describe, expect, it } from "vitest";

// Schema-only tests for the signup payload validator.
// Real signup-flow integration tests come in Day 5 (E2E) — they need
// a running server + email mock. These cover the input contract.

import { z } from "zod";

const signupSchema = z.object({
  company_name: z.string().trim().min(2).max(100),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(10).max(128),
  region: z.enum(["us", "eu"]),
});

describe("signup payload validation", () => {
  const valid = {
    company_name: "Ryan Law Firm",
    name: "Jane Doe",
    email: "Jane@RyanLaw.com",
    password: "longenough10",
    region: "us" as const,
  };

  it("accepts a clean payload", () => {
    const result = signupSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("jane@ryanlaw.com"); // lowercased
      expect(result.data.region).toBe("us");
    }
  });

  it("trims company name and rejects too-short", () => {
    const result = signupSchema.safeParse({ ...valid, company_name: "  X  " });
    expect(result.success).toBe(false);
  });

  it("rejects too-short password", () => {
    const result = signupSchema.safeParse({ ...valid, password: "short1" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = signupSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects unsupported region", () => {
    const result = signupSchema.safeParse({ ...valid, region: "asia" });
    expect(result.success).toBe(false);
  });

  it("normalizes email to lowercase", () => {
    const result = signupSchema.safeParse({
      ...valid,
      email: "JANE.DOE@EXAMPLE.COM",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("jane.doe@example.com");
  });
});
