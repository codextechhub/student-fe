import { Home } from "lucide-react";
import { Link } from "react-router";

import { PageShell } from "@/components/layout/page-shell";
import { SchoolMark } from "@/components/school-mark";
import { schoolLogoUrl } from "@/utils/school-brand";
import { currentSchoolSlug } from "@/utils/school-host";

import "./not-found.css";

/** Any address under /student/ the app does not have, before or after sign-in. */
export function NotFoundPage() {
  const slug = currentSchoolSlug();

  return <PageShell className="not-found-page">
    <div className="not-found-wrap">
      <header className="not-found-header">
        <span className="not-found-mark">
          <SchoolMark logo={slug ? schoolLogoUrl(slug) : null} size={34} animate={false} alt="School crest" />
        </span>
        <strong>Page not found</strong>
      </header>
      <div className="not-found-stage">
        <div className="not-found-visual" aria-hidden="true">
          <svg className="not-found-orbit" viewBox="0 0 520 650" preserveAspectRatio="none">
            <path d="M45 110C115 110 94 211 189 204c83-5 55-118 151-100 84 15 40 99 112 119M29 504c101 7 114-88 182-87 93 1 68 134 196 81" />
          </svg>
          <div className="not-found-art">
            <span className="not-found-glow" />
            <span className="not-found-back-card" />
            <span className="not-found-front-card">
              <span className="not-found-card-head"><i /><i /><i /></span>
              <span className="not-found-number">404</span>
              <span className="not-found-card-line" />
              <span className="not-found-card-line is-short" />
            </span>
            <span className="not-found-compass">
              <svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="18" /><path d="m30 18-4 12-8 2 4-12z" /></svg>
            </span>
          </div>
        </div>
        <section className="not-found-copy-side" aria-labelledby="not-found-message">
          <div className="not-found-copy">
            <span className="not-found-eyebrow">Wrong turn</span>
            <h1 id="not-found-message">We couldn&apos;t find this page.</h1>
            <p>The link may be old, or the address may have changed.</p>
            <Link to="/" className="not-found-home"><Home size={19} aria-hidden="true" />Go to Home</Link>
          </div>
        </section>
      </div>
    </div>
  </PageShell>;
}
