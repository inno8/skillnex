import Link from "next/link";

import { TopBar } from "@/components/topbar";
import { UploadDropzone } from "@/components/upload-dropzone";
import { Logo } from "@/components/brand/logo";
import { getOptionalAuth } from "@/lib/auth/middleware";
import { latestUpload } from "@/lib/db";

export const dynamic = "force-dynamic";

/* ----------------------------------------------------------------
 * Landing page (unauthenticated) + tenant-scoped Ingest page
 * (authenticated). The two share this route because the marketing
 * surface and the in-app upload surface live at "/" — branching on
 * the session keeps the URL clean for both.
 * ---------------------------------------------------------------- */

export default async function HomePage() {
  const ctx = await getOptionalAuth();
  if (!ctx) return <Marketing />;

  let lastUpload = null;
  try {
    lastUpload = latestUpload(ctx.tenant.id);
  } catch {
    lastUpload = null;
  }
  const canIngest = ["owner", "admin", "manager"].includes(ctx.user.role);

  return (
    <>
      <TopBar crumbs={[{ label: "Ingest" }]} />
      <div
        className="fade-in"
        style={{ maxWidth: 880, margin: "0 auto", padding: "48px 24px 64px" }}
      >
        <div style={{ marginBottom: 32 }}>
          <div className="t-micro">Step 1 of 3 · Ingest · {ctx.tenant.name}</div>
          <h1 className="t-h1" style={{ margin: "6px 0 10px" }}>
            {canIngest
              ? "Stop spending three days prepping data before every review cycle."
              : "Your review is being prepared."}
          </h1>
          <p className="t-body" style={{ color: "var(--muted-1)", maxWidth: "60ch" }}>
            {canIngest ? (
              <>
                Every review cycle, HR manually bridges Workday, Salesforce, Jira, and a dozen
                spreadsheets to give managers something factual to write from. Skillnex reads your
                workbook once, joins it, and flags where the data disagrees with the manager's
                rating. Not a Lattice replacement — a way to replace the three days <em>before</em>{" "}
                you open Lattice.
              </>
            ) : (
              <>
                Your HR team uploads source data here every cycle. Once they do, a manager-approved
                summary of your contribution will appear in your inbox.
              </>
            )}
          </p>
          {canIngest && lastUpload && (
            <p className="t-small" style={{ marginTop: 12, color: "var(--muted-2)" }}>
              Last upload:{" "}
              <span className="font-mono" style={{ fontSize: 12 }}>
                {lastUpload.filename}
              </span>{" "}
              · Shape {lastUpload.shape} ·{" "}
              <span className="tabular">{lastUpload.employee_count}</span> employees ·{" "}
              <span className="tabular">{new Date(lastUpload.uploaded_at).toLocaleString()}</span>
            </p>
          )}
        </div>

        {canIngest ? (
          <UploadDropzone />
        ) : (
          <div
            className="card"
            style={{
              padding: "32px 28px",
              textAlign: "center",
              color: "var(--muted-1)",
            }}
          >
            Upload is available to managers, admins, and owners. Reach out to your HR lead if you
            think this is wrong.
          </div>
        )}
      </div>
    </>
  );
}

/* ================================================================
 * MARKETING LANDING
 * ================================================================ */

function Marketing() {
  return (
    <div style={{ background: "var(--paper)" }}>
      <LandingNav />
      <Hero />
      <Features />
      <Integrations />
      <Cta />
      <Footer />
    </div>
  );
}

function LandingNav() {
  return (
    <nav className="landing-nav">
      <div className="landing-nav-inner">
        <Link href="/" className="landing-logo">
          <Logo size={28} />
          <span className="landing-logo-text">skillnex</span>
        </Link>
        <div className="landing-nav-links">
          <a href="#features">Features</a>
          <a href="#integrations">Integrations</a>
          <a href="#how-it-works">How it works</a>
        </div>
        <div className="landing-nav-cta">
          <Link href="/login" className="btn btn-ghost btn-sm" style={{ textDecoration: "none" }}>
            Sign in
          </Link>
          <Link
            href="/signup"
            className="btn btn-primary btn-sm"
            style={{ textDecoration: "none" }}
          >
            Start free pilot
          </Link>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="hero">
      <div className="hero-badge fade-in">
        <span className="hero-badge-dot" />
        Built for HR teams who want narratives, not spreadsheets
      </div>
      <h1 className="hero-title fade-in" style={{ animationDelay: "100ms" }}>
        Replace the three days <em>before</em> you open Lattice.
      </h1>
      <p className="hero-subtitle fade-in" style={{ animationDelay: "200ms" }}>
        Skillnex joins your roster with compensation and activity data, scores every employee with a
        department-aware ROI model, and drafts review-ready narratives — every claim sourced to a
        number. Managers edit. They don't invent.
      </p>
      <div className="hero-cta fade-in" style={{ animationDelay: "300ms" }}>
        <Link
          href="/signup"
          className="btn btn-primary"
          style={{
            height: 48,
            fontSize: 16,
            padding: "0 28px",
            textDecoration: "none",
          }}
        >
          Start free pilot
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
        <div className="hero-screenshot-stub">
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 18,
              marginBottom: 8,
              color: "var(--muted-1)",
              fontVariationSettings: '"opsz" 36',
            }}
          >
            Product preview
          </div>
          <div style={{ fontSize: 14 }}>
            Dashboard · People list · Calibration scatter · Employee narrative
          </div>
        </div>
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
          scores per department, flags the rows where data disagrees with the rating, and drafts
          each review.
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
          title="LLM-drafted narratives"
          body="Claude Haiku 4.5 generates each review from the joined dataset. A post-LLM guard rejects any number not present in the source — managers edit drafts, never invent them."
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
};

const INTEGRATIONS: Integration[] = [
  {
    name: "Workday",
    initials: "Wd",
    blurb: "Comp, headcount, org tree, tenure",
    category: "HR / Payroll",
    status: "Pilot",
  },
  {
    name: "BambooHR",
    initials: "Bh",
    blurb: "Roster, time-off, performance ratings",
    category: "HR / Payroll",
    status: "Pilot",
  },
  {
    name: "ADP",
    initials: "AD",
    blurb: "Salary, bonus, equity, total cost",
    category: "HR / Payroll",
    status: "Q2 2026",
  },
  {
    name: "Greenhouse",
    initials: "Gh",
    blurb: "Hire dates, requisitions, source",
    category: "HR / Payroll",
    status: "Q3 2026",
  },
  {
    name: "Salesforce",
    initials: "Sf",
    blurb: "Revenue, deals closed, pipeline velocity",
    category: "Sales",
    status: "Pilot",
  },
  {
    name: "HubSpot",
    initials: "Hs",
    blurb: "Deals, calls, emails, opportunities",
    category: "Sales",
    status: "Q2 2026",
  },
  {
    name: "Jira",
    initials: "Ji",
    blurb: "Tickets closed, story points, fix time",
    category: "Engineering",
    status: "Pilot",
  },
  {
    name: "GitHub",
    initials: "Gh",
    blurb: "PRs, review turnaround, commit signals",
    category: "Engineering",
    status: "Pilot",
  },
  {
    name: "Linear",
    initials: "Li",
    blurb: "Issue throughput, cycle time, projects",
    category: "Engineering",
    status: "Q2 2026",
  },
  {
    name: "GitLab",
    initials: "Gl",
    blurb: "MRs, pipeline health, code review",
    category: "Engineering",
    status: "Q3 2026",
  },
  {
    name: "Lattice",
    initials: "La",
    blurb: "Existing reviews, goals, 1:1 cadence",
    category: "Reviews",
    status: "Q2 2026",
  },
  {
    name: "15Five",
    initials: "1F",
    blurb: "Check-ins, ratings, OKR alignment",
    category: "Reviews",
    status: "Q3 2026",
  },
];

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
              <div className="integration-logo" aria-hidden="true">
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

function Cta() {
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
            href="/signup"
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
            Start free pilot
            <ArrowIcon />
          </Link>
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
            <Logo size={24} />
            <span className="footer-brand-text">skillnex</span>
          </div>
          <p className="footer-tagline">
            Department-aware employee ROI analysis with review-ready narrative summaries. Built for
            HR teams who need more than spreadsheets.
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
 * Inline icons (kept here so the landing page is one self-contained file)
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
