import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create your Skillnex account",
};

export default function SignupPage() {
  return (
    <AuthShell variant="register">
      <h1 className="auth-title">Start your first cycle.</h1>
      <p className="auth-subtitle">
        Free for 90 days. No credit card. We sign a Data Processing Agreement before any employee
        data is uploaded.
      </p>

      <SignupForm />

      <div className="auth-footer">
        Already have an account?{" "}
        <a href="/login" className="auth-link">
          Sign in
        </a>
      </div>
    </AuthShell>
  );
}
