import type { ReactNode } from 'react'
import { GITHUB_REPO_URL, SITE_CREDIT, SITE_NAME } from '../../config/site'
import { HOME_HASH, INTRO_HASH, SYSTEM_HASH } from '../../state/router'

const LOGO = '/wand-horizon-logo.png'

export function GithubIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 .2a8 8 0 0 0-2.5 15.6c.4.1.55-.17.55-.38v-1.35c-2.23.48-2.7-1.07-2.7-1.07-.36-.93-.89-1.18-.89-1.18-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.72 1.22 1.88.87 2.34.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 .2Z" />
    </svg>
  )
}

/** The button that leads to the real repository (configured in src/config/site.ts). */
export function RepoLink({ className }: { className: string }) {
  return (
    <a className={className} href={GITHUB_REPO_URL} target="_blank" rel="noreferrer noopener">
      <GithubIcon /> View GitHub Repository
    </a>
  )
}

/** Top bar shared by the landing page and the demo. `children` are the page's own links. */
export function SiteHeader({ label, children }: { label: string; children: ReactNode }) {
  return (
    <header className="lnav">
      <div className="lnav__inner">
        <a className="lnav__brand" href={HOME_HASH} aria-label={`${SITE_NAME} home`}>
          <img src={LOGO} alt={SITE_NAME} width="865" height="314" />
        </a>
        <nav className="lnav__links" aria-label={label}>
          {children}
        </nav>
        <a className="lbtn lbtn--primary lbtn--sm" href={SYSTEM_HASH}>
          Explore the System
        </a>
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="lfoot">
      <div className="wrap lfoot__inner">
        <img src={LOGO} alt={SITE_NAME} width="865" height="314" />
        <p>A browser prototype on synthetic data. Not production-grade security.</p>
        <a href={INTRO_HASH}>Brand film</a>
        <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer noopener">
          GitHub
        </a>
      </div>
      <p className="lfoot__credit">{SITE_CREDIT}</p>
    </footer>
  )
}
