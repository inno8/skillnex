import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Reset your Skillnex password",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell variant="forgot">
      <h1 className="auth-title">Reset your password.</h1>
      <p className="auth-subtitle">
        Enter your work email and we'll send a reset link. Valid for 1 hour.
      </p>

      <ForgotPasswordForm />

      <div className="auth-footer">
        Remembered it?{" "}
        <a href="/login" className="auth-link">
          Back to sign in
        </a>
      </div>
    </AuthShell>
  );
}
