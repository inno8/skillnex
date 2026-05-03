import Link from "next/link";

import { Logo } from "@/components/brand/logo";

export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  initials: string;
};

const TESTIMONIALS: Record<"login" | "register" | "forgot" | "reset", Testimonial> = {
  login: {
    quote:
      "Skillnex turned six spreadsheets and two weeks of manual work into one afternoon. The narratives it drafts are better than what I'd write myself.",
    name: "Maren Koepp",
    role: "VP People · Fernweh",
    initials: "MK",
  },
  register: {
    quote:
      "The calibration view changed how we think about performance conversations. Seeing everyone on one scatter plot makes the outliers obvious.",
    name: "Jonas Hartmann",
    role: "Director of Ops · Zephyr",
    initials: "JH",
  },
  forgot: {
    quote:
      "We chose Skillnex because the LLM-drafted reviews actually sound like something a person would write — and every claim is sourced.",
    name: "Simone Patel",
    role: "Head of People · Axiom",
    initials: "SP",
  },
  reset: {
    quote:
      "Department-aware ROI is the right mental model. A recruiter and an AE shouldn't share a leaderboard, and Skillnex doesn't pretend they should.",
    name: "Ari Tan",
    role: "CHRO · Northwind",
    initials: "AT",
  },
};

export function AuthShell({
  children,
  variant = "login",
}: {
  children: React.ReactNode;
  variant?: keyof typeof TESTIMONIALS;
}) {
  const t = TESTIMONIALS[variant];
  return (
    <div className="auth-container fade-in">
      <div className="auth-left">
        <div className="auth-card">
          <Link href="/" className="auth-logo">
            <Logo size={32} />
            <span className="auth-logo-text">skillnex</span>
          </Link>
          {children}
        </div>
      </div>
      <aside className="auth-right">
        <div className="testimonial">
          <blockquote className="testimonial-quote">&ldquo;{t.quote}&rdquo;</blockquote>
          <div className="testimonial-author">
            <div className="testimonial-avatar">{t.initials}</div>
            <div>
              <div className="testimonial-name">{t.name}</div>
              <div className="testimonial-role">{t.role}</div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
