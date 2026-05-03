import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Choose a new Skillnex password",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  if (!token || error === "INVALID_TOKEN" || error === "TOKEN_EXPIRED") {
    return (
      <AuthShell variant="reset">
        <h1 className="auth-title">That link expired.</h1>
        <p className="auth-subtitle">Reset links are valid for 1 hour. Request a new one.</p>
        <a
          href="/forgot-password"
          className="btn btn-primary"
          style={{
            width: "100%",
            height: 42,
            fontSize: 15,
            justifyContent: "center",
          }}
        >
          Request new reset link
        </a>
      </AuthShell>
    );
  }

  return (
    <AuthShell variant="reset">
      <h1 className="auth-title">Choose a new password.</h1>
      <p className="auth-subtitle">
        At least 10 characters. Anything you'd be comfortable saying out loud in a meeting is
        probably too short.
      </p>

      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
