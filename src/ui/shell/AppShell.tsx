import { useMemo, type ReactNode } from 'react'
import { findings } from '../../domain/findings'
import { authorityAtRisk, queueCounts } from '../../domain/selectors'
import type { SimRole } from '../../domain/types'
import { SCREEN_LABEL, useNav, type Screen } from '../../state/nav'
import { useApp } from '../../state/store'
import { Button } from '../primitives/Button'
import { Icon, type IconName } from '../primitives/Icon'
import { Logo, PRODUCT_LINE } from '../primitives/Logo'
import './shell.css'

interface NavEntry {
  screen: Screen
  icon: IconName
}

const ROLE_LABEL: Record<SimRole, string> = { executive: 'Executive', manager: 'Manager', investigator: 'Investigator' }

export function AppShell({ children }: { children: ReactNode }) {
  const { state, setActingAs, reset } = useApp()
  const { screen, go, back, backTo, toast, dismissToast, notify } = useNav()
  const counts = useMemo(() => queueCounts(state), [state])
  const atRisk = useMemo(() => authorityAtRisk(state).length, [state])
  const openFindings = useMemo(() => findings(state).length, [state])
  const openItems = counts.blocked + counts.conflicts + counts.concerns

  const item = (n: NavEntry, count?: number, critical?: boolean, countTitle?: string) => (
    <button
      key={n.screen}
      className="nav__item"
      title={SCREEN_LABEL[n.screen]}
      aria-current={screen === n.screen ? 'page' : undefined}
      onClick={() => go(n.screen, null, { fresh: true })}
    >
      <Icon name={n.icon} />
      <span className="nav__label">{SCREEN_LABEL[n.screen]}</span>
      {count ? (
        <span className={`nav__count num${critical ? ' nav__count--critical' : ''}`} title={countTitle}>
          {count}
        </span>
      ) : null}
    </button>
  )

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <Logo tone="dark" />
          <p className="brand__line">{PRODUCT_LINE}</p>
        </div>

        <nav className="nav" aria-label="Primary">
          {item({ screen: 'overview', icon: 'overview' })}
          <div className="nav__group">Operate</div>
          {item({ screen: 'queue', icon: 'queue' }, openItems, counts.criticalBlocked > 0, 'Open items in the work queue')}
          {item({ screen: 'workforce', icon: 'workforce' }, openFindings, false, 'Open findings on the workforce map')}
          <div className="nav__group">Assure</div>
          {item({ screen: 'governance', icon: 'governance' }, atRisk, true, 'In-progress operations that would be denied if run now')}
        </nav>

        <div className="side__foot">
          <Button
            size="sm"
            onClick={() => {
              reset()
              notify('Demo reset to its original data.')
            }}
            aria-label="Reset demo"
            title="Reset demo"
          >
            <Icon name="reset" size={14} />
            <span>Reset demo</span>
          </Button>
          <p className="side__sim">A browser simulation. Not production-grade security.</p>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          {backTo && (
            <Button className="topbar__back" variant="ghost" size="sm" onClick={back}>
              <Icon name="arrow" size={14} style={{ transform: 'rotate(180deg)' }} />
              Back to {SCREEN_LABEL[backTo.screen]}
            </Button>
          )}
          <span className="topbar__spacer" />
          <div className="who" title="Simulated role. Sets the actor recorded in audit events. Not authentication or authorization.">
            <span>
              <span className="who__prefix">Simulated · </span>
              <span className="who__name">{state.actingAs.name}</span>
            </span>
            <select aria-label="Acting as (simulated role)" value={state.actingAs.role} onChange={(e) => setActingAs(e.target.value as SimRole)}>
              {(Object.keys(ROLE_LABEL) as SimRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
        </header>
        <main id="main">{children}</main>
      </div>

      {toast && (
        <div className="toast" role="status">
          <span>{toast.message}</span>
          {toast.link && (
            <button
              onClick={() => {
                go(toast.link!.screen, toast.link!.id)
                dismissToast()
              }}
            >
              {toast.link.label}
            </button>
          )}
          <button onClick={dismissToast} aria-label="Dismiss">
            <Icon name="close" size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
