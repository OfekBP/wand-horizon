import { useMemo, type ReactNode } from 'react'
import { queueCounts } from '../../domain/selectors'
import type { SimRole } from '../../domain/types'
import { useNav, type Screen } from '../../state/nav'
import { useApp } from '../../state/store'
import { Button } from '../primitives/Button'
import { Icon, type IconName } from '../primitives/Icon'
import './shell.css'

const NAV: { screen: Screen; label: string; icon: IconName }[] = [
  { screen: 'overview', label: 'Overview', icon: 'overview' },
  { screen: 'queue', label: 'Work Queue', icon: 'queue' },
  { screen: 'workforce', label: 'Workforce', icon: 'workforce' },
  { screen: 'governance', label: 'Governance', icon: 'governance' },
]

const ROLE_LABEL: Record<SimRole, string> = { executive: 'Executive', manager: 'Manager', investigator: 'Investigator' }

export function AppShell({ children }: { children: ReactNode }) {
  const { state, setActingAs, reset } = useApp()
  const { screen, go, toast, dismissToast, notify } = useNav()
  const counts = useMemo(() => queueCounts(state), [state])

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <div className="brand__mark" aria-hidden="true">
            HW
          </div>
          <div className="brand__text">
            <div className="brand__name">Workforce Command</div>
            <div className="brand__sub">Hybrid operations</div>
          </div>
        </div>

        <nav className="nav" aria-label="Primary">
          {NAV.map((n) => (
            <button key={n.screen} className="nav__item" aria-current={screen === n.screen ? 'page' : undefined} onClick={() => go(n.screen)}>
              <Icon name={n.icon} />
              <span className="nav__label">{n.label}</span>
              {n.screen === 'queue' && counts.blocked + counts.conflicts + counts.concerns > 0 && (
                <span className={`nav__count num${counts.criticalBlocked ? ' nav__count--critical' : ''}`} title="Open items">
                  {counts.blocked + counts.conflicts + counts.concerns}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="side__foot">
          <div className="field">
            <label htmlFor="acting-as">Acting as (simulated)</label>
            <select id="acting-as" className="select" value={state.actingAs.role} onChange={(e) => setActingAs(e.target.value as SimRole)}>
              {(Object.keys(ROLE_LABEL) as SimRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            <span className="field__hint">
              Recorded as <strong>{state.actingAs.name}</strong>. Simulated: sets the actor in audit events and is not authentication or authorization.
            </span>
          </div>
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
          <p className="side__sim">Browser simulation. Not production-grade security.</p>
        </div>
      </aside>

      <main className="main" id="main">
        {children}
      </main>

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
