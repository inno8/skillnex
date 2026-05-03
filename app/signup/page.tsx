import { Metadata } from "next";

import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create your Skillnex account",
};

export default function SignupPage() {
  return (
    <div
      className="fade-in"
      style={{ maxWidth: 460, margin: "0 auto", padding: "60px 24px 96px" }}
    >
      <p className="t-micro" style={{ marginBottom: 8 }}>
        Step 1 of 3 — Create account
      </p>
      <h1
        className="t-h1"
        style={{ margin: "0 0 8px", fontSize: "1.875rem" }}
      >
        Start your Skillnex pilot.
      </h1>
      <p
        className="t-body"
        style={{ color: "var(--muted-1)", marginBottom: 28 }}
      >
        Free for 90 days. No credit card. We sign a Data Processing Agreement
        before any data is uploaded. Cancel anytime.
      </p>

      <SignupForm />

      <p className="t-small" style={{ marginTop: 24, color: "var(--muted-2)" }}>
        Already have an account?{" "}
        <a
          href="/login"
          style={{ color: "var(--accent)", textDecoration: "none" }}
        >
          Sign in
        </a>
        .
      </p>
    </div>
  );
}
