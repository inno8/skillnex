import { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in to Skillnex",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string; reset?: string }>;
}) {
  return (
    <div
      className="fade-in"
      style={{ maxWidth: 420, margin: "0 auto", padding: "60px 24px 96px" }}
    >
      <p className="t-micro" style={{ marginBottom: 8 }}>
        Sign in
      </p>
      <h1
        className="t-h1"
        style={{ margin: "0 0 24px", fontSize: "1.875rem" }}
      >
        Welcome back.
      </h1>

      <LoginBanner searchParams={searchParams} />

      <LoginForm />

      <p className="t-small" style={{ marginTop: 24, color: "var(--muted-2)" }}>
        New to Skillnex?{" "}
        <a
          href="/signup"
          style={{ color: "var(--accent)", textDecoration: "none" }}
        >
          Create an account
        </a>
        .
      </p>
    </div>
  );
}

async function LoginBanner({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string; reset?: string }>;
}) {
  const params = await searchParams;
  if (params.verified === "1") {
    return (
      <div
        className="card"
        style={{
          padding: "10px 14px",
          marginBottom: 16,
          background: "var(--success-tint)",
          color: "var(--success)",
          fontSize: 13,
        }}
      >
        Email verified. You can sign in now.
      </div>
    );
  }
  if (params.reset === "1") {
    return (
      <div
        className="card"
        style={{
          padding: "10px 14px",
          marginBottom: 16,
          background: "var(--success-tint)",
          color: "var(--success)",
          fontSize: 13,
        }}
      >
        Password reset. Sign in with your new password.
      </div>
    );
  }
  return null;
}
