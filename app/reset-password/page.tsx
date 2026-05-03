import { Metadata } from "next";

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
      <div
        className="fade-in"
        style={{ maxWidth: 420, margin: "0 auto", padding: "60px 24px 96px" }}
      >
        <p className="t-micro" style={{ marginBottom: 8 }}>
          Reset password
        </p>
        <h1 className="t-h1" style={{ margin: "0 0 16px", fontSize: "1.875rem" }}>
          That link expired.
        </h1>
        <p className="t-body" style={{ color: "var(--muted-1)", marginBottom: 24 }}>
          Reset links are valid for 1 hour. Request a new one.
        </p>
        <a
          href="/forgot-password"
          className="btn btn-primary"
          style={{ height: 40, textDecoration: "none" }}
        >
          Request new reset link
        </a>
      </div>
    );
  }

  return (
    <div
      className="fade-in"
      style={{ maxWidth: 420, margin: "0 auto", padding: "60px 24px 96px" }}
    >
      <p className="t-micro" style={{ marginBottom: 8 }}>
        Reset password
      </p>
      <h1 className="t-h1" style={{ margin: "0 0 8px", fontSize: "1.875rem" }}>
        Choose a new password.
      </h1>
      <p className="t-body" style={{ color: "var(--muted-1)", marginBottom: 28 }}>
        At least 10 characters. Anything you'd be comfortable saying out loud
        in a meeting is probably too short.
      </p>

      <ResetPasswordForm token={token} />
    </div>
  );
}
