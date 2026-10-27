import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { DEMO_VIDEO_URL, GITHUB_REPO_URL, SITE_CREDIT, SITE_NAME } from '../../config/site'
import { SYSTEM_HASH } from '../../state/route'
import './landing.css'

const LOGO = '/wand-horizon-logo.png'

const CAPABILITIES: { title: string; body: string; tags: ('Intelligence' | 'Accountability')[] }[] = [
  {
    title: 'Workforce mapping',
    body: 'A map of the whole organization: who reports to whom, which person owns which AI workers, and which mission each worker serves.',
    tags: ['Intelligence'],
  },
  {
    title: 'Actionable findings',
    body: 'Findings are derived from live data, ranked, and tied to a decision. Resolve one and it disappears from the map, the queue and the overview together.',
    tags: ['Intelligence'],
  },
  {
    title: 'Conflict and bottleneck detection',
    body: 'Duplicated work, contradictory objectives, and critical work blocked behind an unavailable decision-maker are surfaced with how they came about.',
    tags: ['Intelligence'],
  },
  {
    title: 'Operational decisions',
    body: 'Move a blocked decision to an available person, choose which worker is authoritative, or pause workers. Each action writes an audit event.',
    tags: ['Intelligence', 'Accountability'],
  },
  {
    title: 'Audit trails',
    body: 'Permissions are folded from an append-only event log ordered by sequence number. Nothing is edited, so history is correct by construction.',
    tags: ['Accountability'],
  },
  {
    title: 'Historical authorization replay',
    body: 'Scrub an incident and see what the AI worker was authorized to do at that moment beside what it is permitted today. The stored decision never changes.',
    tags: ['Accountability'],
  },
]

/** Reveals children once, when they scroll into view. Without IntersectionObserver or with reduced motion they are simply visible. */
function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    el.classList.add('reveal--armed')
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.add('reveal--in')
          io.disconnect()
        }
      },
      { threshold: 0.12 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

/**
 * A decorative picture of the scale: 50 people (rings) and 500 AI workers (dots) in eight groups.
 * It is an illustration only: positions are generated, not read from any data.
 */
function Constellation() {
  const nodes = useMemo(() => {
    let seed = 20261026
    const rnd = () => {
      seed = (seed + 0x6d2b79f5) | 0
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    const out: { x: number; y: number; human: boolean; lit: boolean; d: number }[] = []
    for (let g = 0; g < 8; g++) {
      const cx = 90 + (g % 4) * 160
      const cy = 80 + Math.floor(g / 4) * 170
      for (let i = 0; i < 62; i++) {
        const a = rnd() * Math.PI * 2
        const r = Math.sqrt(rnd()) * 62
        out.push({ x: cx + Math.cos(a) * r * 1.15, y: cy + Math.sin(a) * r * 0.95, human: i < 6, lit: false, d: rnd() * 6 })
      }
    }
    // one small cluster is highlighted to suggest the story: something specific to look at
    for (const n of out.slice(out.length - 14)) if (!n.human) n.lit = true
    return out
  }, [])
  return (
    <svg
      className="constellation"
      viewBox="0 0 660 340"
      role="img"
      aria-label="Illustration: a few dozen people and several hundred AI workers arranged in eight teams. Decorative, not real data."
    >
      {nodes.map((n, i) =>
        n.human ? (
          <circle key={i} cx={n.x} cy={n.y} r="4" className="cn cn--human" />
        ) : (
          <circle key={i} cx={n.x} cy={n.y} r="2.2" className={n.lit ? 'cn cn--lit' : 'cn cn--ai'} style={{ animationDelay: `${n.d}s` }} />
        ),
      )}
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function GithubIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 .2a8 8 0 0 0-2.5 15.6c.4.1.55-.17.55-.38v-1.35c-2.23.48-2.7-1.07-2.7-1.07-.36-.93-.89-1.18-.89-1.18-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.72 1.22 1.88.87 2.34.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 .2Z" />
    </svg>
  )
}

function scrollToId(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
}

function RepoLink({ className }: { className: string }) {
  return (
    <a className={className} href={GITHUB_REPO_URL} target="_blank" rel="noreferrer noopener">
      <GithubIcon /> View GitHub Repository
    </a>
  )
}

export function Landing() {
  return (
    <div className="landing">
      <header className="lnav">
        <div className="lnav__inner">
          <a className="lnav__brand" href="#/" aria-label={`${SITE_NAME} home`}>
            <img src={LOGO} alt={SITE_NAME} width="865" height="314" />
          </a>
          <nav className="lnav__links" aria-label="Page sections">
            <button onClick={() => scrollToId('challenges')}>Challenges</button>
            <button onClick={() => scrollToId('approach')}>Approach</button>
            <button onClick={() => scrollToId('honesty')}>About the data</button>
            {DEMO_VIDEO_URL && (
              <a href={DEMO_VIDEO_URL} target="_blank" rel="noreferrer noopener">
                Demo video
              </a>
            )}
          </nav>
          <a className="lbtn lbtn--primary lbtn--sm" href={SYSTEM_HASH}>
            Explore the System
          </a>
        </div>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero__glow" aria-hidden="true" />
          <div className="wrap hero__grid">
            <div className="hero__copy">
              <p className="eyebrow">Hybrid workforce operations</p>
              <h1 id="hero-title">
                One workforce. <span className="accent">Full accountability.</span>
              </h1>
              <p className="lede">
                Wand Horizon gives leadership one place to see a hybrid workforce of people and AI workers, decide what is stuck or in conflict, and prove what any AI worker was allowed to do at the moment it acted.
              </p>
              <div className="actions">
                <a className="lbtn lbtn--primary" href={SYSTEM_HASH}>
                  Explore the System <ArrowIcon />
                </a>
                <RepoLink className="lbtn lbtn--ghost" />
              </div>
              <p className="hero__note">The System runs in your browser on synthetic data: 50 people and 500 AI workers. No backend, no real models.</p>
            </div>
            <div className="hero__visual">
              <Constellation />
              <p className="caption">Illustration of the scale: 50 people (rings) and 500 AI workers (dots). Not real data.</p>
            </div>
          </div>
        </section>

        <section id="challenges" className="lsection" aria-labelledby="challenges-title">
          <div className="wrap">
            <Reveal>
              <p className="eyebrow">Two questions, one product</p>
              <h2 id="challenges-title">
                The problems <span className="accent">Wand Horizon</span> is built around
              </h2>
            </Reveal>
            <div className="duo">
              <Reveal className="lcard" delay={60}>
                <span className="lcard__index">01</span>
                <h3>Workforce Intelligence</h3>
                <p className="lcard__q">
                  How can leadership understand the performance of 50 human employees and 500 AI workers, identify conflicting work, and uncover blocked business outcomes?
                </p>
                <p className="lcard__a">
                  Wand Horizon draws ownership and missions, keeps verified value apart from estimates and unmeasured work, and finds what is duplicated, contradictory, or waiting on someone who is out of office.
                </p>
              </Reveal>
              <Reveal className="lcard" delay={140}>
                <span className="lcard__index">02</span>
                <h3>AI Accountability</h3>
                <p className="lcard__q">
                  How can an organization prove what an AI worker was authorized to do at a specific moment, even when permissions change during an operation?
                </p>
                <p className="lcard__a">
                  Authorization is checked when an action executes and recorded with the evidence it relied on. Later changes add events; they never rewrite an earlier decision.
                </p>
              </Reveal>
            </div>
          </div>
        </section>

        <section id="approach" className="lsection lsection--tint" aria-labelledby="approach-title">
          <div className="wrap">
            <Reveal>
              <p className="eyebrow">How it works</p>
              <h2 id="approach-title">See it. Understand it. Decide. Then prove it.</h2>
              <p className="lsection__lede">Six capabilities working on the same underlying records, so no screen can disagree with another.</p>
            </Reveal>
            <ul className="caps">
              {CAPABILITIES.map((c, i) => (
                <li key={c.title}>
                  <Reveal className="cap" delay={(i % 3) * 70}>
                    <div className="cap__tags">
                      {c.tags.map((t) => (
                        <span key={t} className={`tag tag--${t.toLowerCase()}`}>
                          {t}
                        </span>
                      ))}
                    </div>
                    <h3>{c.title}</h3>
                    <p>{c.body}</p>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="honesty" className="lsection" aria-labelledby="honesty-title">
          <div className="wrap honesty">
            <Reveal>
              <p className="eyebrow">About the data</p>
              <h2 id="honesty-title">A prototype that is clear about what it measures</h2>
            </Reveal>
            <Reveal delay={80}>
              <dl className="lfacts">
                <div>
                  <dt>Synthetic data</dt>
                  <dd>Every person, AI worker, mission, dollar amount and event in the System is generated for the demo. Nothing is connected to a real company.</dd>
                </div>
                <div>
                  <dt>Three kinds of value, kept apart</dt>
                  <dd>Verified, estimated and unmeasured value are never added together. No return on investment, savings or profit is calculated anywhere.</dd>
                </div>
                <div>
                  <dt>Simulated comparisons</dt>
                  <dd>Cost changes compare against a simulated previous period and are labeled as such. They are not measurements.</dd>
                </div>
                <div>
                  <dt>Not production security</dt>
                  <dd>The authorization logic demonstrates a policy and an audit design in the browser. It is not an access-control system.</dd>
                </div>
              </dl>
            </Reveal>
          </div>
        </section>

        <section className="cta" aria-labelledby="cta-title">
          <div className="wrap">
            <Reveal>
              <h2 id="cta-title">
                Open the System and try it <span className="accent">yourself</span>
              </h2>
              <p className="lsection__lede">Follow a blocked $2.4M settlement from the map to a decision, then replay an incident to see what an AI worker was authorized to do.</p>
              <div className="actions actions--center">
                <a className="lbtn lbtn--primary" href={SYSTEM_HASH}>
                  Explore the System <ArrowIcon />
                </a>
                <RepoLink className="lbtn lbtn--ghost" />
                {DEMO_VIDEO_URL && (
                  <a className="lbtn lbtn--ghost" href={DEMO_VIDEO_URL} target="_blank" rel="noreferrer noopener">
                    Watch the demo
                  </a>
                )}
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="lfoot">
        <div className="wrap lfoot__inner">
          <img src={LOGO} alt={SITE_NAME} width="865" height="314" />
          <p>A browser prototype on synthetic data. Not production-grade security.</p>
          <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer noopener">
            GitHub
          </a>
        </div>
        <p className="lfoot__credit">{SITE_CREDIT}</p>
      </footer>
    </div>
  )
}
