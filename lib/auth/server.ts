/**
 * Better-auth server configuration.
 *
 * Multi-tenant: every signup creates a new tenant + Owner user.
 * Email + password is the MVP path; SSO post-pilot.
 */

import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

import { getDb } from "@/lib/db";
import { generateId } from "@/lib/db/backfill";
import { sendVerificationEmail } from "@/lib/email/resend";

const baseUrl =
  process.env.SKILLNEX_BASE_URL ?? "http://localhost:3000";

export const auth = betterAuth({
  database: getDb(),
  baseURL: baseUrl,
  secret: process.env.SKILLNEX_AUTH_SECRET ?? "dev-only-secret-change-me",
  emailAndPassword: {
    enabled: true,
    // The public POST /api/auth/sign-up/email endpoint is intercepted in
    // app/api/auth/[...all]/route.ts and returns 404. /api/signup wraps
    // auth.api.signUpEmail (programmatic, bypasses the HTTP intercept)
    // and is the single sanctioned entry point for new accounts.
    requireEmailVerification: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    autoSignIn: false,
    sendResetPassword: async ({ user, url }) => {
      await sendVerificationEmail({
        to: user.email,
        verifyUrl: url,
        intent: "reset_password",
      });
    },
    resetPasswordTokenExpiresIn: 60 * 60, // 1 hour
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail({
        to: user.email,
        verifyUrl: url,
        intent: "verify_email",
      });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh once per 24h
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 min cookie cache
    },
  },
  user: {
    additionalFields: {
      // input:true so /api/signup can pass these via the body cast.
      // /api/auth/sign-up/email is NOT a public endpoint we advertise —
      // /api/signup is the only sanctioned entry point and it derives
      // tenant_id + role server-side from validated input.
      tenant_id: { type: "string", required: true, input: true },
      role: {
        type: "string",
        required: true,
        defaultValue: "owner",
        input: true,
      },
      status: {
        type: "string",
        required: true,
        defaultValue: "active",
        input: true,
      },
      employee_key: { type: "string", required: false, input: false },
      soft_deleted_at: { type: "string", required: false, input: false },
      last_login_at: { type: "string", required: false, input: false },
    },
  },
  advanced: {
    database: {
      generateId: ({ model }) => {
        // Map better-auth's models to our prefix convention
        const prefix =
          model === "user"
            ? "usr"
            : model === "session"
              ? "ses"
              : model === "account"
                ? "acc"
                : model === "verification"
                  ? "ver"
                  : "obj";
        return generateId(prefix as "tnt" | "usr" | "ses" | "inv");
      },
    },
  },
  plugins: [nextCookies()], // must be last per better-auth docs
});

export type Session = typeof auth.$Infer.Session;
