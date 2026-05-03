/**
 * Transactional email via Resend.
 *
 * Falls back to console.log when RESEND_API_KEY is missing — useful for
 * local dev so signup/login flows work without a real email account.
 */

import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;

// Both env names supported because the README + .env.local.example used
// RESEND_FROM_EMAIL while the code originally only read SKILLNEX_EMAIL_FROM.
// Falling back to Resend's onboarding sandbox is intentional but heavily
// rate-limited and ONLY delivers to the email that owns the Resend account
// — that's why pilot signups appeared to silently drop. Set a verified
// domain in Resend + RESEND_FROM_EMAIL=... in .env.local to actually send.
const fromAddress =
  process.env.RESEND_FROM_EMAIL ??
  process.env.SKILLNEX_EMAIL_FROM ??
  "Skillnex <onboarding@resend.dev>";
const isMock = !apiKey;

const client = isMock ? null : new Resend(apiKey);

// Log the email config exactly once at boot so misconfiguration is obvious
// in `next dev` output instead of silently dropping signups.
let _logged = false;
function logConfigOnce() {
  if (_logged) return;
  _logged = true;
  if (isMock) {
    console.log(
      "[email] RESEND_API_KEY not set — running in MOCK mode (emails printed to stdout, not sent).",
    );
  } else {
    const isSandbox = /onboarding@resend\.dev/i.test(fromAddress);
    console.log(`[email] live mode · from=${fromAddress}`);
    if (isSandbox) {
      console.warn(
        "[email] WARN: using Resend sandbox sender (onboarding@resend.dev). Resend will only deliver to the email address that owns your Resend account. Add a verified domain and set RESEND_FROM_EMAIL=... in .env.local to send to anyone else.",
      );
    }
  }
}

export type EmailResult = { ok: true; id: string } | { ok: false; error: string };

async function send(args: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<EmailResult> {
  logConfigOnce();
  if (isMock || !client) {
    // Dev mode: print the email to the server log instead of sending.
    console.log(
      `\n[email mock] to=${args.to}\n  subject: ${args.subject}\n  ${args.text.replace(/\n/g, "\n  ")}\n`,
    );
    return { ok: true, id: `mock_${Date.now()}` };
  }
  try {
    const result = await client.emails.send({
      from: fromAddress,
      to: args.to,
      subject: args.subject,
      text: args.text,
      html: args.html,
    });
    if (result.error) {
      // Loud failure — better-auth callbacks tend to swallow this otherwise.
      console.error(`[email] Resend rejected message to ${args.to}: ${result.error.message}`);
      return { ok: false, error: String(result.error.message) };
    }
    console.log(`[email] sent to=${args.to} id=${result.data?.id ?? "?"}`);
    return { ok: true, id: result.data?.id ?? "unknown" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[email] send threw for ${args.to}:`, msg);
    return { ok: false, error: msg };
  }
}

export async function sendVerificationEmail(args: {
  to: string;
  verifyUrl: string;
  intent: "verify_email" | "reset_password" | "magic_link";
}): Promise<EmailResult> {
  const labels = {
    verify_email: {
      subject: "Verify your Skillnex account",
      heading: "Welcome to Skillnex",
      body: "Click the link below to verify your email address and finish setting up your account. This link is valid for 1 hour.",
      cta: "Verify email",
    },
    reset_password: {
      subject: "Reset your Skillnex password",
      heading: "Reset your password",
      body: "We received a request to reset your password. Click the link below to choose a new one. If you didn't request this, ignore this email — your password stays the same. Link valid for 1 hour.",
      cta: "Reset password",
    },
    magic_link: {
      subject: "Your Skillnex sign-in link",
      heading: "Sign in to Skillnex",
      body: "Click the link below to sign in. Valid for 15 minutes. If you didn't request this, ignore this email.",
      cta: "Sign in",
    },
  } as const;
  const l = labels[args.intent];
  const text = `${l.heading}\n\n${l.body}\n\n${l.cta}: ${args.verifyUrl}\n\nIf the button doesn't work, copy and paste the URL into your browser.`;
  const html = `<!doctype html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 40px auto; padding: 0 24px; color: #0b0f19; line-height: 1.55;">
  <h1 style="font-family: Georgia, serif; font-size: 1.5rem; font-weight: 500; margin: 0 0 16px;">${l.heading}</h1>
  <p style="margin: 0 0 24px; color: #52525b;">${l.body}</p>
  <p style="margin: 0 0 32px;">
    <a href="${args.verifyUrl}" style="display: inline-block; padding: 12px 20px; background: #c2410c; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: 500;">${l.cta}</a>
  </p>
  <p style="font-size: 0.8125rem; color: #71717a; margin: 0;">If the button doesn't work, copy this URL into your browser:<br>
    <a href="${args.verifyUrl}" style="color: #71717a;">${args.verifyUrl}</a>
  </p>
  <hr style="border: 0; border-top: 1px solid #e7e5e0; margin: 32px 0 16px;">
  <p style="font-size: 0.75rem; color: #a1a1aa; margin: 0;">Skillnex · ${args.to}</p>
</body></html>`;
  return send({ to: args.to, subject: l.subject, text, html });
}

export async function sendInvitationEmail(args: {
  to: string;
  inviterName: string;
  tenantName: string;
  role: string;
  acceptUrl: string;
}): Promise<EmailResult> {
  const subject = `${args.inviterName} invited you to ${args.tenantName} on Skillnex`;
  const text = `${args.inviterName} invited you to join ${args.tenantName} on Skillnex as a ${args.role}.\n\nClick to accept and create your account: ${args.acceptUrl}\n\nThis invitation expires in 7 days.`;
  const html = `<!doctype html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 40px auto; padding: 0 24px; color: #0b0f19; line-height: 1.55;">
  <h1 style="font-family: Georgia, serif; font-size: 1.5rem; font-weight: 500; margin: 0 0 16px;">You're invited to ${args.tenantName}</h1>
  <p style="margin: 0 0 24px; color: #52525b;"><strong>${args.inviterName}</strong> invited you to join <strong>${args.tenantName}</strong> on Skillnex as a <strong>${args.role}</strong>.</p>
  <p style="margin: 0 0 32px;">
    <a href="${args.acceptUrl}" style="display: inline-block; padding: 12px 20px; background: #c2410c; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: 500;">Accept invitation</a>
  </p>
  <p style="font-size: 0.8125rem; color: #71717a; margin: 0;">This invitation expires in 7 days. If you don't recognize ${args.inviterName} or ${args.tenantName}, ignore this email.</p>
  <hr style="border: 0; border-top: 1px solid #e7e5e0; margin: 32px 0 16px;">
  <p style="font-size: 0.75rem; color: #a1a1aa; margin: 0;">Skillnex · ${args.to}</p>
</body></html>`;
  return send({ to: args.to, subject, text, html });
}
