import Link from "next/link";

import { BrandLockup } from "@/components/brand/lockup";
import { Logo } from "@/components/brand/logo";

/**
 * The right-hand panel of the auth split-screen used to render fake
 * customer testimonials ("MK · VP People · Fernweh"). Skillnex doesn't
 * have customers yet — pilot stage — so those quotes were dishonest.
 *
 * Replaced with statements that are actually true about the product
 * right now: how scoring works, what the data hygiene guarantees are,
 * what the post-LLM guard does, etc. Attribution is the Skillnex mark
 * itself — no invented people, no invented logos.
 *
 * Each variant gets a different principle so the same user sees a
 * different one on login vs reset vs signup.
 */

export type Principle = {
  kicker: string;
  body: string;
  meta: string;
};

const PRINCIPLES: Record<"login" | "register" | "forgot" | "reset", Principle> = {
  login: {
    kicker: "How the performance reviews work",
    body: "Every claim in a Skillnex-drafted performance review ties back to a number in your data. A post-LLM guard rejects any figure that isn't in the source. Managers edit drafts. They don't invent them.",
    meta: "Sourced · auditable · human-approved",
  },
  register: {
    kicker: "Department-aware by design",
    body: "Sales sells. Engineers ship. Recruiters hire. Three jobs, three ROI models, three different conversations — and Skillnex doesn't pretend a recruiter and an AE belong on the same leaderboard.",
    meta: "Sales · Engineering · HR scoring",
  },
  forgot: {
    kicker: "The data hygiene that should be the floor",
    body: "Single tenant per company. Region pinning, US or EU. 30-day EU retention cap enforced as a SQL trigger, not a policy doc. Append-only audit log. DPA before any employee data touches a server.",
    meta: "Multi-tenant · auditable · GDPR-ready",
  },
  reset: {
    kicker: "Why Skillnex exists",
    body: "Every performance review cycle, HR spends three days bridging Workday, Salesforce, Jira, and a dozen spreadsheets to give managers something factual to write from. Skillnex does the bridging once, every cycle. The judgment stays yours.",
    meta: "Replace the prep work, not the judgment",
  },
};

export function AuthShell({
  children,
  variant = "login",
}: {
  children: React.ReactNode;
  variant?: keyof typeof PRINCIPLES;
}) {
  const p = PRINCIPLES[variant];
  return (
    <div className="auth-container fade-in">
      <div className="auth-left">
        <div className="auth-card">
          <Link href="/" className="auth-logo">
            <BrandLockup width={150} />
          </Link>
          {children}
        </div>
      </div>
      <aside className="auth-right">
        <div className="testimonial">
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 12px",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "rgba(255,255,255,0.65)",
              marginBottom: 24,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                background: "var(--accent)",
                borderRadius: "50%",
              }}
            />
            {p.kicker}
          </div>
          <blockquote className="testimonial-quote">{p.body}</blockquote>
          <div className="testimonial-author">
            <div
              className="testimonial-avatar"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.15)",
                padding: 6,
              }}
            >
              <Logo size={28} />
            </div>
            <div>
              <div className="testimonial-name">Skillnex</div>
              <div className="testimonial-role">{p.meta}</div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
