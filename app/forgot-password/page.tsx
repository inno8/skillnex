import { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Reset your Skillnex password",
};

export default function ForgotPasswordPage() {
  return (
    <div
      className="fade-in"
      style={{ maxWidth: 420, margin: "0 auto", padding: "60px 24px 96px" }}
    >
      <p className="t-micro" style={{ marginBottom: 8 }}>
        Reset password
      </p>
      <h1
        className="t-h1"
        style={{ margin: "0 0 8px", fontSize: "1.875rem" }}
      >
        Forgot your password?
      </h1>
      <p
        className="t-body"
        style={{ color: "var(--muted-1)", marginBottom: 28 }}
      >
        Enter your work email and we'll send a reset link. Valid for 1 hour.
      </p>

      <ForgotPasswordForm />

      <p className="t-small" style={{ marginTop: 24, color: "var(--muted-2)" }}>
        Remembered it?{" "}
        <a
          href="/login"
          style={{ color: "var(--accent)", textDecoration: "none" }}
        >
          Back to sign in
        </a>
        .
      </p>
    </div>
  );
}
