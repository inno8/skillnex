/**
 * Transactional email via Resend.
 *
 * Falls back to console.log when RESEND_API_KEY is missing — useful for
 * local dev so signup/login flows work without a real email account.
 */

import { Resend } from "resend";

// IMPORTANT: read env vars inside resolveConfig() (called per send), NOT at
// module top-level. ES module imports are hoisted, so when a tsx script
// does `dotenv(".env.local")` *after* the import line, the env is loaded
// AFTER this module has already evaluated its top-level consts — meaning
// any const here would read process.env BEFORE .env.local is in scope and
// silently fall through to the sandbox defaults. Lazy resolution avoids it.
//
// `next dev` loads .env.local before user code so it doesn't hit this, but
// the tsx scripts (seed:user, verify:user, test:email) and any other CJS
// caller will. Better to be lazy everywhere than have two code paths.

let _client: Resend | null | undefined;
function getClient(apiKey: string | undefined): Resend | null {
  if (!apiKey) return null;
  if (_client === undefined || _client === null) {
    _client = new Resend(apiKey);
  }
  return _client;
}

function resolveConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress =
    process.env.RESEND_FROM_EMAIL ??
    process.env.SKILLNEX_EMAIL_FROM ??
    "Skillnex <onboarding@resend.dev>";
  return { apiKey, fromAddress, isMock: !apiKey };
}

// Log the email config the first time we actually try to send so the
// resolved values reflect any late-loaded .env.local. Idempotent.
let _logged = false;
function logConfigOnce(cfg: ReturnType<typeof resolveConfig>) {
  if (_logged) return;
  _logged = true;
  if (cfg.isMock) {
    console.log(
      "[email] RESEND_API_KEY not set — running in MOCK mode (emails printed to stdout, not sent).",
    );
    return;
  }
  console.log(`[email] live mode · from=${cfg.fromAddress}`);
  if (/onboarding@resend\.dev/i.test(cfg.fromAddress)) {
    console.warn(
      "[email] WARN: using Resend sandbox sender (onboarding@resend.dev). Resend will only deliver to the email address that owns your Resend account. Add a verified domain and set RESEND_FROM_EMAIL=... in .env.local to send to anyone else.",
    );
  }
}

export type EmailResult = { ok: true; id: string } | { ok: false; error: string };

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

async function send(args: {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: EmailAttachment[];
}): Promise<EmailResult> {
  const cfg = resolveConfig();
  logConfigOnce(cfg);
  const client = getClient(cfg.apiKey);
  if (cfg.isMock || !client) {
    // Dev mode: print the email to the server log instead of sending.
    const attLine =
      args.attachments && args.attachments.length > 0
        ? `\n  attachments: ${args.attachments.map((a) => `${a.filename} (${a.content.length}B)`).join(", ")}`
        : "";
    console.log(
      `\n[email mock] to=${args.to}\n  subject: ${args.subject}${attLine}\n  ${args.text.replace(/\n/g, "\n  ")}\n`,
    );
    return { ok: true, id: `mock_${Date.now()}` };
  }
  try {
    const result = await client.emails.send({
      from: cfg.fromAddress,
      to: args.to,
      subject: args.subject,
      text: args.text,
      html: args.html,
      // Resend accepts attachments either as { content: base64String }
      // or via a path. We pass Buffers from pdfkit, so base64-encode
      // here before sending.
      ...(args.attachments && args.attachments.length > 0
        ? {
            attachments: args.attachments.map((a) => ({
              filename: a.filename,
              content: a.content.toString("base64"),
              ...(a.contentType ? { content_type: a.contentType } : {}),
            })),
          }
        : {}),
    });
    if (result.error) {
      // Loud failure — better-auth callbacks tend to swallow this otherwise.
      console.error(`[email] Resend rejected message to ${args.to}: ${result.error.message}`);
      return { ok: false, error: String(result.error.message) };
    }
    console.log(`[email] sent to=${args.to} from=${cfg.fromAddress} id=${result.data?.id ?? "?"}`);
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

/**
 * Email a finalized performance review to an employee. Renders the
 * narrative paragraph, optional cover note from the manager, and the
 * supporting strengths/watch items into a clean HTML email.
 *
 * The intent here is "the review IS the email" — pilot employees don't
 * have Skillnex accounts, so we don't try to deep-link them into
 * /my-review. The full review text is in the body.
 */
export async function sendReviewEmail(args: {
  to: string;
  employeeName: string;
  reviewerName: string;
  tenantName: string;
  cycleLabel?: string;
  reviewParagraph: string;
  summary: string;
  strengths: string[];
  watchItems: string[];
  coverNote?: string;
  /** Optional PDF (or other) attachments. The share endpoint passes a
   *  rendered review PDF so the recipient has a printable archival
   *  copy alongside the inline-readable email body. */
  attachments?: EmailAttachment[];
}): Promise<EmailResult> {
  const subject = `Your performance review · ${args.tenantName}${args.cycleLabel ? ` · ${args.cycleLabel}` : ""}`;

  const text = [
    `Hi ${args.employeeName.split(" ")[0]},`,
    "",
    args.coverNote ? `${args.coverNote}\n` : "",
    args.summary,
    "",
    args.reviewParagraph,
    "",
    args.strengths.length > 0 ? "What stood out:" : "",
    ...args.strengths.map((s) => `  • ${s}`),
    args.watchItems.length > 0 ? "" : "",
    args.watchItems.length > 0 ? "Things to watch:" : "",
    ...args.watchItems.map((s) => `  • ${s}`),
    "",
    `— ${args.reviewerName}`,
    `${args.tenantName}`,
    "",
    "Every number in this review is from data your HR team uploaded.",
    "Reach out to your manager if anything looks wrong.",
  ]
    .filter((l) => l !== null)
    .join("\n");

  const safe = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const html = `<!doctype html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 640px; margin: 32px auto; padding: 0 24px; color: #0b0f19; line-height: 1.55;">
  <p style="margin: 0 0 16px;">Hi ${safe(args.employeeName.split(" ")[0])},</p>
  ${args.coverNote ? `<p style="margin: 0 0 24px; color: #52525b;">${safe(args.coverNote).replace(/\n/g, "<br>")}</p>` : ""}
  <p style="margin: 0 0 12px; font-family: Georgia, serif; font-size: 18px; font-weight: 500; color: #0b0f19;">
    ${safe(args.summary)}
  </p>
  <p style="margin: 0 0 28px; font-size: 15px;">
    ${safe(args.reviewParagraph).replace(/\n/g, "<br>")}
  </p>
  ${
    args.strengths.length > 0
      ? `<div style="margin: 0 0 20px;">
           <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #71717a; margin-bottom: 8px;">What stood out</div>
           <ul style="margin: 0; padding-left: 20px;">
             ${args.strengths.map((s) => `<li style="margin: 0 0 6px;">${safe(s)}</li>`).join("")}
           </ul>
         </div>`
      : ""
  }
  ${
    args.watchItems.length > 0
      ? `<div style="margin: 0 0 20px;">
           <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #71717a; margin-bottom: 8px;">Things to watch</div>
           <ul style="margin: 0; padding-left: 20px;">
             ${args.watchItems.map((s) => `<li style="margin: 0 0 6px;">${safe(s)}</li>`).join("")}
           </ul>
         </div>`
      : ""
  }
  <hr style="border: 0; border-top: 1px solid #e7e5e0; margin: 28px 0 16px;">
  <p style="margin: 0 0 4px; font-size: 14px;">— ${safe(args.reviewerName)}</p>
  <p style="margin: 0 0 16px; font-size: 13px; color: #71717a;">${safe(args.tenantName)}</p>
  <p style="font-size: 12px; color: #a1a1aa; margin: 24px 0 0;">
    Every number in this review is from data your HR team uploaded. Reach out
    to your manager if anything looks wrong.
  </p>
</body></html>`;

  return send({ to: args.to, subject, text, html, attachments: args.attachments });
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
