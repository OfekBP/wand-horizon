import { permissionsAsOf } from '../../../domain/authorize'
import { SCOPES } from '../../../domain/reducer'
import type { AuditEvent } from '../../../domain/types'
import { Badge } from '../../primitives/Badge'
import { money } from '../../format'
import './workforce.css'

/** Permission picture for one worker as of a seq cutoff. Used live (Workforce) and historically (Governance). */
export function PermissionsList({
  events,
  workerId,
  cutoffSeq,
  highlightScope,
  changedScope,
}: {
  events: AuditEvent[]
  workerId: string
  cutoffSeq: number
  highlightScope?: string
  changedScope?: string
}) {
  const perms = permissionsAsOf(events, workerId, cutoffSeq)
  const scopes = Object.keys(perms)
  if (scopes.length === 0) return <div className="small muted">No permission had been granted at this point.</div>
  return (
    <div className="perm-list">
      {scopes.map((s) => {
        const p = perms[s]
        return (
          <div key={s} className={`perm${s === highlightScope ? ' perm--hl' : ''}`}>
            <div className="perm__scope">
              <div className="strong">{SCOPES[s] ?? s}</div>
              <div className="xs mono">{s}</div>
              {s === changedScope && <div className="xs">Changed by this event</div>}
            </div>
            {p.active ? (
              <Badge tone="ok" dot>
                Active · {p.limit !== undefined ? `limit ${money(p.limit)}` : 'no limit'}
              </Badge>
            ) : (
              <Badge tone="critical" dot>
                Revoked
              </Badge>
            )}
          </div>
        )
      })}
    </div>
  )
}
