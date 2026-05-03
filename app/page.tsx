import Link from "next/link";

import { BrandLockup } from "@/components/brand/lockup";
import { getOptionalAuth } from "@/lib/auth/middleware";

export const dynamic = "force-dynamic";

/* ----------------------------------------------------------------
 * Marketing landing page — always rendered at /, regardless of
 * session state. The authenticated ingest UI lives at /ingest. We
 * still read the session here, but only to swap the nav CTA: when
 * authed, "Sign in" / "Start free pilot" becomes "Open app".
 * ---------------------------------------------------------------- */

export default async function HomePage() {
  const ctx = await getOptionalAuth();
  const isAuthed = ctx !== null;

  return (
    <div style={{ background: "var(--paper)" }}>
      <LandingNav isAuthed={isAuthed} />
      <Hero isAuthed={isAuthed} />
      <Features />
      <Integrations />
      <Cta isAuthed={isAuthed} />
      <Footer />
    </div>
  );
}

function LandingNav({ isAuthed }: { isAuthed: boolean }) {
  return (
    <nav className="landing-nav">
      <div className="landing-nav-inner">
        <Link href="/" className="landing-logo">
          <BrandLockup width={140} />
        </Link>
        <div className="landing-nav-links">
          <a href="#features">Features</a>
          <a href="#integrations">Integrations</a>
          <a href="#how-it-works">How it works</a>
        </div>
        <div className="landing-nav-cta">
          {isAuthed ? (
            <>
              <Link
                href="/logout"
                prefetch={false}
                className="btn btn-ghost btn-sm"
                style={{ textDecoration: "none" }}
              >
                Sign out
              </Link>
              <Link
                href="/dashboard"
                className="btn btn-primary btn-sm"
                style={{ textDecoration: "none" }}
              >
                Open app
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="btn btn-ghost btn-sm"
                style={{ textDecoration: "none" }}
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="btn btn-primary btn-sm"
                style={{ textDecoration: "none" }}
              >
                Start free pilot
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function Hero({ isAuthed }: { isAuthed: boolean }) {
  return (
    <section className="hero">
      <div className="hero-badge fade-in">
        <span className="hero-badge-dot" />
        Quarterly or annual — fair performance reviews, drafted from your team's data
      </div>
      <h1 className="hero-title fade-in" style={{ animationDelay: "100ms" }}>
        Performance reviews, drafted from the data.
      </h1>
      <p className="hero-subtitle fade-in" style={{ animationDelay: "200ms" }}>
        Stop trying to remember what you shipped. Skillnex pulls compensation and activity data from
        your source systems, scores every employee with a department-aware ROI model, and drafts
        each performance review in minutes. Every claim sourced to a number. Managers edit. They
        don't invent.
      </p>
      <div className="hero-cta fade-in" style={{ animationDelay: "300ms" }}>
        <Link
          href={isAuthed ? "/dashboard" : "/signup"}
          className="btn btn-primary"
          style={{
            height: 48,
            fontSize: 16,
            padding: "0 28px",
            textDecoration: "none",
          }}
        >
          {isAuthed ? "Open dashboard" : "Start free pilot"}
          <ArrowIcon />
        </Link>
        <a
          href="#how-it-works"
          className="btn btn-secondary"
          style={{
            height: 48,
            fontSize: 16,
            padding: "0 24px",
            textDecoration: "none",
          }}
        >
          See how it works
        </a>
      </div>

      <div className="hero-screenshot fade-in" style={{ animationDelay: "400ms" }}>
        {/* Real product screenshot. Drop the source PNG into
            public/marketing/product-preview.png and it appears here.
            Recommended dimensions: 2400x1500 (or any 16:10 ratio) so it
            stays sharp on retina displays at the hero's max width. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/marketing/product-preview.png"
          alt="Skillnex employee performance review — Nina Torres, HR, Q1 2026"
          style={{
            width: "100%",
            height: "auto",
            display: "block",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border)",
          }}
        />
      </div>
    </section>
  );
}

/* ================================================================
 * FEATURES
 * ================================================================ */

function Features() {
  return (
    <section className="section section-band" id="features">
      <div className="section-header-center">
        <div className="section-kicker">How it works</div>
        <h2 className="section-title">Ingest. Score. Narrate. Approve.</h2>
        <p className="section-desc">
          Upload one workbook — or connect your source systems. Skillnex joins on employee ID,
          scores per department, flags the rows where data disagrees with the existing rating, and
          drafts each performance review.
        </p>
      </div>

      <div className="feature-grid">
        <FeatureCard
          title="Multi-sheet ingest"
          body="Drop an .xlsx with roster, comp, performance ratings, and HR activity. Skillnex detects the shape, joins on employee ID, and reports every row that didn't reconcile — no silent drops."
          icon={<UploadIcon />}
        />
        <FeatureCard
          title="Department-aware scoring"
          body="One ROI model for Sales (revenue per $1 salary), another for Engineering (PRs + tickets), another for HR (cost per impacted employee). Recruiters and AEs don't share a leaderboard."
          icon={<ChartIcon />}
        />
        <FeatureCard
          title="Anomaly-first surface"
          body="Score-vs-rating mismatch. Underpaid hi-perf. Low-ROI senior. Missing salary. Every flag is one click from the row that triggered it — the conversation worth having, not the spreadsheet to scroll."
          icon={<AlertIcon />}
        />
        <FeatureCard
          title="LLM-drafted performance reviews"
          body="Claude Haiku 4.5 generates each review from the joined dataset. A post-LLM guard rejects any number not present in the source — managers edit drafts, never invent them. Employees get a fair review they can push back on with data."
          icon={<SparkIcon />}
        />
        <FeatureCard
          title="Calibration scatter"
          body="Value score × contribution on one chart. Top-right is where promotions compound. Bottom-left is where a scope conversation is due. Hover any dot, click to drill into the data."
          icon={<ScatterIcon />}
        />
        <FeatureCard
          title="Tenant-isolated by design"
          body="Row-level multi-tenancy on every read. Region pinning (US / EU). 30-day EU retention cap enforced in SQL, not in policy. Append-only audit log. DPA signed before any data touches a server."
          icon={<ShieldIcon />}
        />
      </div>
    </section>
  );
}

function FeatureCard({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="feature-card">
      <div className="feature-icon">{icon}</div>
      <h3 className="feature-title">{title}</h3>
      <p className="feature-desc">{body}</p>
    </div>
  );
}

/* ================================================================
 * INTEGRATIONS
 * ================================================================ */

type Integration = {
  name: string;
  initials: string;
  blurb: string;
  category: "HR / Payroll" | "Sales" | "Engineering" | "Reviews";
  status: "Pilot" | "Q2 2026" | "Q3 2026";
  /** Approximate brand color for the monogram tile background. Picked
   *  to match the vendor's marketing — close enough to be recognizable
   *  while we ship without their copyrighted SVG logos. */
  brand: string;
};

const INTEGRATIONS: Integration[] = [
  {
    name: "Workday",
    initials: "Wd",
    blurb: "Comp, headcount, org tree, tenure",
    category: "HR / Payroll",
    status: "Pilot",
    brand: "#0875E1",
  },
  {
    name: "BambooHR",
    initials: "Bh",
    blurb: "Roster, time-off, performance ratings",
    category: "HR / Payroll",
    status: "Pilot",
    brand: "#73C41D",
  },
  {
    name: "ADP",
    initials: "AD",
    blurb: "Salary, bonus, equity, total cost",
    category: "HR / Payroll",
    status: "Q2 2026",
    brand: "#D80132",
  },
  {
    name: "Greenhouse",
    initials: "Gh",
    blurb: "Hire dates, requisitions, source",
    category: "HR / Payroll",
    status: "Q3 2026",
    brand: "#24A47F",
  },
  {
    name: "Salesforce",
    initials: "Sf",
    blurb: "Revenue, deals closed, pipeline velocity",
    category: "Sales",
    status: "Pilot",
    brand: "#00A1E0",
  },
  {
    name: "HubSpot",
    initials: "Hs",
    blurb: "Deals, calls, emails, opportunities",
    category: "Sales",
    status: "Q2 2026",
    brand: "#FF7A59",
  },
  {
    name: "Jira",
    initials: "Ji",
    blurb: "Tickets closed, story points, fix time",
    category: "Engineering",
    status: "Pilot",
    brand: "#2684FF",
  },
  {
    name: "GitHub",
    initials: "Gh",
    blurb: "PRs, review turnaround, commit signals",
    category: "Engineering",
    status: "Pilot",
    brand: "#1F2328",
  },
  {
    name: "Linear",
    initials: "Li",
    blurb: "Issue throughput, cycle time, projects",
    category: "Engineering",
    status: "Q2 2026",
    brand: "#5E6AD2",
  },
  {
    name: "GitLab",
    initials: "Gl",
    blurb: "MRs, pipeline health, code review",
    category: "Engineering",
    status: "Q3 2026",
    brand: "#FC6D26",
  },
  {
    name: "Lattice",
    initials: "La",
    blurb: "Existing reviews, goals, 1:1 cadence",
    category: "Reviews",
    status: "Q2 2026",
    brand: "#7A26C1",
  },
  {
    name: "15Five",
    initials: "15",
    blurb: "Check-ins, ratings, OKR alignment",
    category: "Reviews",
    status: "Q3 2026",
    brand: "#0094F0",
  },
];

/** Pick black or white text against a hex background based on luminance.
 *  Keeps the monogram readable on both bright (Salesforce blue) and dark
 *  (GitHub near-black) tile colors. */
function readableTextColor(hex: string): string {
  const v = hex.replace("#", "");
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  // Rec. 709 luma — close enough; switch threshold around mid-bright.
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luma > 0.62 ? "#0B0F19" : "#FFFFFF";
}

function Integrations() {
  return (
    <section className="section" id="integrations">
      <div className="section-header-center">
        <div className="section-kicker">Connect your stack</div>
        <h2 className="section-title">Skip the spreadsheet. Pull from source.</h2>
        <p className="section-desc">
          Skillnex starts with .xlsx so you can run a cycle today. The integrations below replace
          the manual export step — same scoring, same narratives, refreshed continuously instead of
          quarterly.
        </p>
      </div>

      <div className="integration-grid">
        {INTEGRATIONS.map((i) => (
          <article key={i.name} className="integration-card">
            <div className="integration-card-head">
              <div
                className="integration-logo"
                aria-hidden="true"
                style={{
                  // Brand-tinted tile so each vendor is recognizable at
                  // a glance. Drop a real SVG into public/integrations/
                  // <slug>.svg and swap to <img> when we license logos.
                  background: i.brand,
                  color: readableTextColor(i.brand),
                  border: "1px solid rgba(11,15,25,0.08)",
                }}
              >
                {i.initials}
              </div>
              <span className={`chip ${i.status === "Pilot" ? "chip-success" : "chip-neutral"}`}>
                {i.status}
              </span>
            </div>
            <h3 className="integration-name">{i.name}</h3>
            <p className="integration-blurb">{i.blurb}</p>
            <span className="integration-meta">{i.category}</span>
          </article>
        ))}
      </div>

      <p
        className="t-small"
        style={{
          textAlign: "center",
          marginTop: 32,
          color: "var(--muted-2)",
          maxWidth: 640,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        Need something not on the list? The xlsx ingest path covers any source that can export a
        sheet. Roadmap above prioritized by pilot demand.
      </p>
    </section>
  );
}

/* ================================================================
 * CTA + FOOTER
 * ================================================================ */

function Cta({ isAuthed }: { isAuthed: boolean }) {
  return (
    <section className="cta-section" id="how-it-works">
      <div className="section">
        <h2 className="cta-title">Ready to run your first cycle?</h2>
        <p className="cta-desc">
          Free 90-day pilot. No credit card. Upload your roster + activity, see Skillnex generate
          narratives in minutes, decide whether to keep going.
        </p>
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <Link
            href={isAuthed ? "/dashboard" : "/signup"}
            className="btn"
            style={{
              background: "#fff",
              color: "var(--ink)",
              height: 48,
              fontSize: 16,
              padding: "0 28px",
              textDecoration: "none",
            }}
          >
            {isAuthed ? "Open dashboard" : "Start free pilot"}
            <ArrowIcon />
          </Link>
          {!isAuthed && (
            <Link
              href="/login"
              className="btn"
              style={{
                background: "transparent",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.3)",
                height: 48,
                fontSize: 16,
                padding: "0 24px",
                textDecoration: "none",
              }}
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <div className="footer-brand">
            <BrandLockup width={130} />
          </div>
          <p className="footer-tagline">
            Quarterly or annual performance reviews, drafted from your team's actual data.
            Department-aware scoring. Every claim sourced.
          </p>
        </div>

        <div>
          <div className="footer-heading">Product</div>
          <div className="footer-links">
            <a href="#features">Features</a>
            <a href="#integrations">Integrations</a>
            <a href="#how-it-works">How it works</a>
            <a href="/signup">Start a pilot</a>
          </div>
        </div>

        <div>
          <div className="footer-heading">Company</div>
          <div className="footer-links">
            <a href="#">About</a>
            <a href="mailto:hello@skillnex.app">Contact</a>
            <a href="#">Security</a>
            <a href="#">Status</a>
          </div>
        </div>

        <div>
          <div className="footer-heading">Legal</div>
          <div className="footer-links">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
            <a href="#">DPA</a>
            <a href="#">GDPR</a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div>© 2026 Skillnex. All rights reserved.</div>
        <div style={{ display: "flex", gap: 20 }}>
          <a
            href="https://github.com/inno8/skillnex"
            style={{ color: "var(--muted-2)", textDecoration: "none" }}
          >
            GitHub
          </a>
          <a href="#" style={{ color: "var(--muted-2)", textDecoration: "none" }}>
            LinkedIn
          </a>
        </div>
      </div>
    </footer>
  );
}

/* ================================================================
 * Inline icons
 * ================================================================ */

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <Icon>
      <path d="M12 3v12M7 8l5-5 5 5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </Icon>
  );
}
function ChartIcon() {
  return (
    <Icon>
      <path d="M3 3v18h18" />
      <path d="M7 14l3-3 4 4 5-7" />
    </Icon>
  );
}
function AlertIcon() {
  return (
    <Icon>
      <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />
    </Icon>
  );
}
function SparkIcon() {
  return (
    <Icon>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M6.3 17.7l2.8-2.8M14.9 9.1l2.8-2.8" />
    </Icon>
  );
}
function ScatterIcon() {
  return (
    <Icon>
      <path d="M3 17l6-6 4 4 8-8M13 7h8v8" />
    </Icon>
  );
}
function ShieldIcon() {
  return (
    <Icon>
      <path d="M12 2l8 4v6c0 5-3.5 9.4-8 10-4.5-.6-8-5-8-10V6l8-4z" />
      <path d="M9 12l2 2 4-4" />
    </Icon>
  );
}
