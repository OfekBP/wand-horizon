import { useMemo, useState } from 'react'
import { classifyAiWorkers } from '../../../domain/selectors'
import type { PermissionChangedEvent, Worker } from '../../../domain/types'
import { useNav } from '../../../state/nav'
import { useApp } from '../../../state/store'
import { EventTimeline } from '../../audit/EventTimeline'
import { money } from '../../format'
import { Badge, StatusBadge } from '../../primitives/Badge'
import { Button } from '../../primitives/Button'
import { Overlay } from '../../primitives/Overlay'
import { PermissionDialog } from './PermissionDialog'
import { PermissionsList } from './PermissionsList'

export function WorkerDrawer({ worker, onClose }: { worker: Worker; onClose: () => void }) {
  const { state, index } = useApp()
  const { go } = useNav()
  const [editing, setEditing] = useState(false)
  const team = index.teamById.get(worker.teamId)
  const owner = worker.ownerId ? index.workerById.get(worker.ownerId) : undefined
  const isAi = worker.kind === 'ai'

  const valueClass = useMemo(() => classifyAiWorkers(state).get(worker.id), [state, worker.id])
  const records = state.values.filter((v) => v.workerId === worker.id)
  const ops = state.operations.filter((o) => o.workerId === worker.id || o.decisionOwnerId === worker.id)
  const owned = state.workers.filter((w) => w.ownerId === worker.id)
  const concerns = state.concerns.filter((c) => c.workerId === worker.id && c.status === 'open')
  const history = useMemo(
    () => state.events.filter((e): e is PermissionChangedEvent => e.type === 'PermissionChanged' && e.workerId === worker.id).slice(-4),
    [state.events, worker.id],
  )
  const totalChanges = state.events.filter((e) => e.type === 'PermissionChanged' && e.workerId === worker.id).length

  return (
    <>
      <Overlay
        variant="drawer"
        title={worker.name}
        subtitle={
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <Badge tone={isAi ? 'accent' : 'neutral'}>{isAi ? 'AI worker' : 'Person'}</Badge>
            <span>
              {worker.role} · {team?.name}
            </span>
          </span>
        }
        onClose={onClose}
        footer={
          <>
            <Button onClick={onClose}>Close</Button>
            {isAi && (
              <Button variant="primary" onClick={() => setEditing(true)}>
                Change permissions
              </Button>
            )}
          </>
        }
      >
        <dl className="facts">
          <div>
            <dt>{isAi ? 'Accountable owner' : 'Reports to'}</dt>
            <dd>
              {owner ? (
                <button className="link" onClick={() => go('workforce', owner.id)}>
                  {owner.name}
                </button>
              ) : (
                'None (top of the organization)'
              )}
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd style={{ textTransform: 'capitalize' }}>{worker.status}</dd>
          </div>
          <div>
            <dt>{isAi ? 'Modeled operating cost' : 'Synthetic loaded labor cost'}</dt>
            <dd className="num">{money(worker.monthlyCost)} / month</dd>
          </div>
          {isAi && (
            <div>
              <dt>Value measurement</dt>
              <dd>{valueClass === 'verified' ? 'Verified' : valueClass === 'estimatedOnly' ? 'Estimated only' : 'Unmeasured'}</dd>
            </div>
          )}
        </dl>

        <div>
          <div className="section-label" style={{ marginBottom: 8 }}>
            Responsibilities
          </div>
          <ul className="small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
            {worker.responsibilities.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>

        {isAi && (
          <>
            <div>
              <div className="section-label" style={{ marginBottom: 8 }}>
                Current permissions
              </div>
              <PermissionsList events={state.events} workerId={worker.id} cutoffSeq={state.nextSeq - 1} />
            </div>
            <div>
              <div className="section-label" style={{ marginBottom: 8 }}>
                Permission history ({totalChanges})
              </div>
              <EventTimeline events={history} onSelect={(e) => go('governance', e.id)} />
              {totalChanges > history.length && <div className="xs muted">Showing the latest {history.length}. Select an event to see the state before and after it.</div>}
            </div>
            <div>
              <div className="section-label" style={{ marginBottom: 8 }}>
                Value records (trailing 30 days)
              </div>
              {records.length === 0 ? (
                <div className="small muted">None. This worker is unmeasured.</div>
              ) : (
                <ul className="mini-list">
                  {records.map((r) => (
                    <li key={r.id}>
                      <span>
                        <span className={`sw sw--${r.basis}`} />
                        {r.basis === 'verified' ? 'Verified' : 'Estimated'} · <span className="muted">{r.source}</span>
                      </span>
                      <span className="num strong">{money(r.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {!isAi && owned.length > 0 && (
          <div>
            <div className="section-label" style={{ marginBottom: 8 }}>
              Owns or manages ({owned.length})
            </div>
            <ul className="mini-list">
              {owned.slice(0, 8).map((w) => (
                <li key={w.id}>
                  <button className="link" onClick={() => go('workforce', w.id)}>
                    {w.name}
                  </button>
                  <span className="xs muted">{w.kind === 'ai' ? 'AI worker' : w.role}</span>
                </li>
              ))}
            </ul>
            {owned.length > 8 && <div className="xs muted">and {owned.length - 8} more</div>}
          </div>
        )}

        {ops.length > 0 && (
          <div>
            <div className="section-label" style={{ marginBottom: 8 }}>
              Cases ({ops.length})
            </div>
            <ul className="mini-list">
              {ops.slice(0, 6).map((o) => (
                <li key={o.id}>
                  <button className="link" onClick={() => go('governance', o.id)}>
                    {o.title}
                  </button>
                  <StatusBadge status={o.status} />
                </li>
              ))}
            </ul>
            {ops.length > 6 && <div className="xs muted">and {ops.length - 6} more</div>}
          </div>
        )}

        {concerns.length > 0 && (
          <div className="alert alert--warn">
            {concerns.length} open performance {concerns.length === 1 ? 'concern' : 'concerns'}: {concerns.map((c) => c.metric).join(', ')}.
          </div>
        )}
      </Overlay>
      {editing && <PermissionDialog worker={worker} onClose={() => setEditing(false)} />}
    </>
  )
}
