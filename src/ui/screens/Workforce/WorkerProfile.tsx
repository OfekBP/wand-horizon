import { useMemo } from 'react'
import { buildRoi, ownerReturn, ROI_ACTION, ROI_LABEL, ROI_POLICY, verdict } from '../../../domain/roi'
import { classifyAiWorkers } from '../../../domain/selectors'
import type { PermissionChangedEvent, Worker } from '../../../domain/types'
import { useNav } from '../../../state/navContext'
import { useApp } from '../../../state/appContext'
import { EventTimeline } from '../../audit/EventTimeline'
import { money } from '../../format'
import { Badge, StatusBadge } from '../../primitives/Badge'
import { Button } from '../../primitives/Button'
import { RoiBadge } from '../../primitives/RoiBadge'
import { PermissionsList } from './PermissionsList'
import { TERMS } from '../../terms'

/** What a manager needs first: does this worker earn what it costs, and what should I do about it? */
function ReturnBlock({ worker }: { worker: Worker }) {
  const { state } = useApp()
  const { go } = useNav()
  const model = useMemo(() => buildRoi(state), [state])
  const source = state.values.find((v) => v.workerId === worker.id && v.basis === 'verified')?.source

  if (worker.kind === 'ai') {
    const r = model.byWorker.get(worker.id)
    if (!r) {
      return (
        <section className="roi" aria-label="Return on cost">
          <div className="section-label">Return on cost</div>
          <p className="small muted">Paused, so it is not counted in any return and incurs no run cost.</p>
        </section>
      )
    }
    return (
      <section className="roi" aria-label="Return on cost">
        <div className="section-label">Return on cost</div>
        <div className="roi__head">
          <RoiBadge status={r.status} multiple={r.multiple} />
          <span className="small">
            Suggested: <strong>{ROI_ACTION[r.status]}</strong>
          </span>
        </div>
        <p className="small">{verdict(r, source)}</p>
        <dl className="roi__grid">
          <div>
            <dt>Verified value</dt>
            <dd className="num">{money(r.verified)}</dd>
          </div>
          <div>
            <dt>Modeled cost</dt>
            <dd className="num">{money(r.cost)}</dd>
          </div>
          <div>
            <dt>Net per month</dt>
            <dd className="num">{r.net === null ? 'not measurable' : `${r.net >= 0 ? '+' : '-'}${money(Math.abs(r.net))}`}</dd>
          </div>
          <div>
            <dt>ROI</dt>
            <dd className="num">{r.roiPct === null ? 'n/a' : `${r.roiPct >= 0 ? '+' : ''}${Math.round(r.roiPct).toLocaleString('en-US')}%`}</dd>
          </div>
          <div>
            <dt>Potential, unconfirmed</dt>
            <dd className="num">
              {money(r.estimated)} <span className="xs muted">never counted</span>
            </dd>
          </div>
        </dl>
        <p className="xs muted">
          Green at {ROI_POLICY.greenAt}× or more, red under {ROI_POLICY.redBelow}×. Verified value over modeled cost, trailing 30 days, synthetic data.
        </p>
      </section>
    )
  }

  const g = ownerReturn(state, model, worker.id)
  if (g.workers === 0) return null
  const mine = state.workers.filter((w) => w.ownerId === worker.id && model.byWorker.has(w.id))
  const weakest = mine
    .map((w) => ({ w, r: model.byWorker.get(w.id)! }))
    .filter((x) => x.r.status === 'red' || x.r.status === 'amber')
    .sort((a, b) => (a.r.status === b.r.status ? b.r.cost - a.r.cost : a.r.status === 'red' ? -1 : 1))
    .slice(0, 3)
  return (
    <section className="roi" aria-label="Return of what they run">
      <div className="section-label">Return of what they run</div>
      <div className="roi__head">
        <RoiBadge status={g.status} multiple={g.multiple} />
        <span className="small">{g.workers} AI workers, {money(g.cost)} a month</span>
      </div>
      <p className="small">
        {(['green', 'amber', 'red', 'grey'] as const).map((c) => `${g.counts[c]} ${ROI_LABEL[c].toLowerCase()}`).join(' · ')}. {money(g.unprovenCost)} a month has no verified value.
      </p>
      {weakest.length > 0 && (
        <ul className="mini-list">
          {weakest.map(({ w, r }) => (
            <li key={w.id}>
              <button className="link" onClick={() => go('workforce', w.id)}>
                {w.name}
              </button>
              <RoiBadge status={r.status} multiple={r.multiple} compact />
            </li>
          ))}
        </ul>
      )}
      <p className="xs muted">A person has no value records of their own. This is the return of the AI workers they are accountable for.</p>
    </section>
  )
}

/** One worker, in full. Shared by the registry drawer and the map's situation panel. */
export function WorkerProfile({ worker, onChangePermissions }: { worker: Worker; onChangePermissions?: () => void }) {
  const { state, index } = useApp()
  const { go } = useNav()
  const owner = worker.ownerId ? index.workerById.get(worker.ownerId) : undefined
  const isAi = worker.kind === 'ai'
  const mission = worker.missionId ? state.missions.find((m) => m.id === worker.missionId) : undefined

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
  const away = worker.availability?.status === 'out_of_office'

  return (
    <>
      {away && (
        <div className="alert alert--warn">
          <strong>Out of office</strong>
          {worker.availability?.until ? ` until ${worker.availability.until.slice(0, 10)}` : ''}. {worker.availability?.note}
        </div>
      )}
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
          <dd style={{ textTransform: 'capitalize' }}>{away ? 'Out of office' : worker.status}</dd>
        </div>
        <div>
          <dt>{isAi ? 'Modeled operating cost' : 'Synthetic loaded labor cost'}</dt>
          <dd className="num">{money(worker.monthlyCost)} / month</dd>
        </div>
        {isAi && worker.priorMonthlyCost !== undefined && (
          <div>
            <dt>Previous 30 days (simulated)</dt>
            <dd className="num">{money(worker.priorMonthlyCost)} / month</dd>
          </div>
        )}
        {isAi && (
          <div>
            <dt>Value measurement</dt>
            <dd>{valueClass === 'verified' ? 'Verified' : valueClass === 'estimatedOnly' ? 'Estimated only' : 'Unmeasured'}</dd>
          </div>
        )}
        {isAi && (
          <div>
            <dt>Mission</dt>
            <dd>
              {mission ? (
                <button className="link" onClick={() => go('workforce', mission.id)}>
                  {mission.name}
                </button>
              ) : (
                <span className="muted">Standing responsibility</span>
              )}
            </dd>
          </div>
        )}
      </dl>

      <ReturnBlock worker={worker} />

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
            {onChangePermissions && (
              <div style={{ marginTop: 10 }}>
                <Button size="sm" onClick={onChangePermissions}>
                  {TERMS.changePermissions}
                </Button>
              </div>
            )}
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
      {worker.status === 'paused' && <Badge tone="medium">Paused</Badge>}
    </>
  )
}
