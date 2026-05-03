import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in to Skillnex",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string; reset?: string }>;
}) {
  const params = await searchParams;
  let banner: { kind: "success"; message: string } | null = null;
  if (params.verified === "1") {
    banner = { kind: "success", message: "Email verified. You can sign in now." };
  } else if (params.reset === "1") {
    banner = { kind: "success", message: "Password reset. Sign in with your new password." };
  }

  return (
    <AuthShell variant="login">
      <h1 className="auth-title">Welcome back.</h1>
      <p className="auth-subtitle">Sign in to continue to your Q1 2026 review cycle.</p>

      {banner && <div className={`auth-alert ${banner.kind}`}>{banner.message}</div>}

      <LoginForm />

      <div className="auth-footer">
        New to Skillnex?{" "}
        <a href="/signup" className="auth-link">
          Create an account
        </a>
      </div>
    </AuthShell>
  );
}
