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

/**
 * Region-pinning logic — keeps the runtime check honest by mirroring it
 * here as a pure function. The route handler in app/api/signup/route.ts
 * inlines the same comparison; if you change one, change both.
 */
function regionMismatch(dropletRegion: string | undefined, requestedRegion: "us" | "eu"): boolean {
  return Boolean(dropletRegion && dropletRegion !== requestedRegion);
}

describe("region pinning at signup", () => {
  it("allows signup when SKILLNEX_REGION matches the requested region", () => {
    expect(regionMismatch("us", "us")).toBe(false);
    expect(regionMismatch("eu", "eu")).toBe(false);
  });

  it("rejects signup when SKILLNEX_REGION differs from the requested region", () => {
    expect(regionMismatch("us", "eu")).toBe(true);
    expect(regionMismatch("eu", "us")).toBe(true);
  });

  it("permits any signup when SKILLNEX_REGION is unset (local dev)", () => {
    expect(regionMismatch(undefined, "us")).toBe(false);
    expect(regionMismatch(undefined, "eu")).toBe(false);
    expect(regionMismatch("", "us")).toBe(false);
  });
});
