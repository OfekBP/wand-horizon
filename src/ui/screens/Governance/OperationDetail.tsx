import { useMemo, useState } from 'react'
import { evidenceSummary, REASON_LABEL, scopeStateText } from '../../../domain/audit'
import { replayMatches, scopeStateAsOf } from '../../../domain/authorize'
import { SCOPES } from '../../../domain/reducer'
import { openConflicts, operationOutcomeSeq, operationTimeline, thenVsNow } from '../../../domain/selectors'
import type { AuditEvent, AuthorizationEvaluatedEvent, Operation, ScopeState } from '../../../domain/types'
import { useNav } from '../../../state/navContext'
import { useApp } from '../../../state/appContext'
import { EventTimeline } from '../../audit/EventTimeline'
import { dateTime, money } from '../../format'
import { Badge, SeverityBadge, StatusBadge } from '../../primitives/Badge'
import { Button } from '../../primitives/Button'
import { Icon } from '../../primitives/Icon'
import { Card } from '../../primitives/Layout'
import { PermissionDialog } from '../Workforce/PermissionDialog'
import { TERMS } from '../../terms'
import { PermissionsList } from '../Workforce/PermissionsList'
import { IncidentReplay } from './IncidentReplay'
import './governance.css'

const isEval = (e: AuditEvent | undefined): e is AuthorizationEvaluatedEvent => e?.type === 'AuthorizationEvaluated'

function StateLine({ state, granted }: { state: ScopeState; granted: boolean }) {
  return <span className="strong">{scopeStateText(state, granted)}</span>
}

export function OperationDetail({ op, initialSeq, onBack }: { op: Operation; initialSeq?: number; onBack: () => void }) {
  const { state, index, act } = useApp()
  const { go, notify } = useNav()
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  const timeline = useMemo(() => operationTimeline(state, op), [state, op])
  const opEvents = useMemo(() => timeline.filter((e) => e.operationId === op.id), [timeline, op.id])
  const outcomeSeq = operationOutcomeSeq(opEvents)
  const lastEval = [...opEvents].reverse().find(isEval)
  const [pickedSeq, setPickedSeq] = useState<number | null>(initialSeq ?? null)
  const selected = timeline.find((e) => e.seq === pickedSeq) ?? lastEval ?? timeline[timeline.length - 1]

  const worker = index.workerById.get(op.workerId)
  const owner = index.workerById.get(op.decisionOwnerId)
  const eventBySeq = (id: string) => timeline.find((e) => e.id === id)
  const conflicts = openConflicts(state).filter((c) => c.workerAId === op.workerId || c.workerBId === op.workerId)
  const concerns = state.concerns.filter((c) => c.workerId === op.workerId && c.status === 'open')

  const showReplay = timeline.length >= 3 && (timeline.some((e) => e.type === 'PermissionChanged') || !!lastEval)
  const cutoff = isEval(selected) ? selected.cutoffSeq : selected?.seq ?? state.nextSeq - 1
  const live = scopeStateAsOf(state.events, op.workerId, op.requiredScope, state.nextSeq - 1)
  const verdict = isEval(selected) ? thenVsNow(state, selected) : null
  const replayOk = isEval(selected) ? replayMatches(state.events, selected) : false

  const run = () => {
    const r = act({ type: 'ATTEMPT_EXECUTION', operationId: op.id })
    if (!r.ok) return setError(r.error)
    setError(null)
    const evaluation = r.state.events[r.state.events.length - 2] as AuthorizationEvaluatedEvent
    setPickedSeq(evaluation.seq)
    notify(
      evaluation.decision === 'allowed'
        ? 'Authorization was valid when the action ran. Operation executed.'
        : `Execution prevented: ${REASON_LABEL[evaluation.reasonCode].toLowerCase()}.`,
    )
  }

  const copy = async () => {
    if (!isEval(selected) || !verdict) return
    const text = evidenceSummary({
      operationTitle: op.title,
      operationId: op.id,
      workerName: worker?.name ?? op.workerId,
      evaluation: selected,
      evidence: selected.evidenceChangeIds.map((id) => {
        const ev = eventBySeq(id)
        return { seq: ev?.seq ?? 0, action: ev?.type === 'PermissionChanged' ? ev.action : 'change' }
      }),
      replayMatches: replayOk,
      changedSince: verdict.changedSince.map((c) => ({ seq: c.seq, action: c.action })),
      todayDecision: `${verdict.today.decision === 'allowed' ? 'Allowed' : 'Denied'} (${REASON_LABEL[verdict.today.reasonCode].toLowerCase()})`,
    })
    try {
      await navigator.clipboard.writeText(text)
      notify('Evidence summary copied.')
    } catch {
      notify('Copy was blocked by the browser. Select the text in the panel instead.')
    }
  }

  return (
    <div className="page">
      <div className="gov-head">
        <button className="crumb" onClick={onBack}>
          <Icon name="arrow" size={14} /> All cases
        </button>
        <div className="title-row">
          <h1>{op.title}</h1>
          <SeverityBadge severity={op.severity} />
          <StatusBadge status={op.status} />
        </div>
        <p className="small muted">{op.summary}</p>
      </div>

      <Card flush>
        <dl className="fact-strip">
          <div>
            <dt>Executing AI worker</dt>
            <dd>
              <button className="link" onClick={() => go('workforce', op.workerId)}>
                {worker?.name}
              </button>
            </dd>
          </div>
          <div>
            <dt>Approver</dt>
            <dd>
              <button className="link" onClick={() => owner && go('workforce', owner.id)}>
                {owner?.name}
              </button>
              <div className="xs muted">{owner?.role}</div>
            </dd>
          </div>
          <div>
            <dt>Amount at stake</dt>
            <dd className="num">{money(op.amount)}</dd>
          </div>
          <div>
            <dt>Authority required</dt>
            <dd>
              {SCOPES[op.requiredScope]}
              <div className="seq">{op.requiredScope}</div>
            </dd>
          </div>
          <div>
            <dt>Started</dt>
            <dd>{dateTime(op.startedAt)}</dd>
          </div>
          <div>
            <dt>Operational context</dt>
            <dd>
              {op.status === 'awaiting_approval' ? (
                <button className="link" onClick={() => go('queue', op.id)}>
                  Blocked in the Work Queue
                </button>
              ) : (
                <span className="muted">Not blocked</span>
              )}
              <div className="xs">
                {conflicts.length > 0 ? (
                  <button className="link" onClick={() => go('queue', conflicts[0].id)}>
                    {conflicts.length} open {conflicts.length === 1 ? 'conflict' : 'conflicts'}
                  </button>
                ) : (
                  <span className="muted">No open conflicts</span>
                )}
                {' · '}
                <span className={concerns.length ? 'strong' : 'muted'}>
                  {concerns.length} {concerns.length === 1 ? 'concern' : 'concerns'}
                </span>
              </div>
              <div className="xs">
                <button className="link" onClick={() => go('workforce', `op:${op.id}`)}>
                  See it on the map
                </button>
              </div>
            </dd>
          </div>
        </dl>
      </Card>

      {op.status === 'in_progress' && (
        <div className="alert alert--info policy">
          <div style={{ flex: 1 }}>
            <strong>Execution is pending.</strong> Running the step judges authorization at this moment and stores the decision.
            <div className="xs" style={{ marginTop: 4 }}>
              Permission right now (a live reading, not a stored decision): <strong>{scopeStateText(live.state, live.evidence.length > 0)}</strong>
              {live.state.active && live.state.limit !== undefined && op.amount > live.state.limit ? ` · the ${money(op.amount)} amount exceeds it.` : '.'}
            </div>
          </div>
          <div className="policy__actions">
            {worker && <Button onClick={() => setEditing(true)}>{TERMS.changePermissions}</Button>}
            <Button variant="primary" onClick={run}>
              {TERMS.runStep}
            </Button>
          </div>
        </div>
      )}
      {op.status === 'awaiting_approval' && (
        <div className="alert alert--warn policy">
          <div style={{ flex: 1 }}>
            <strong>Awaiting a human decision.</strong> This operation cannot be executed. The prototype does not simulate the approval step; it shows permission changes ahead of an
            execution attempt.
          </div>
          <Button onClick={() => go('queue', op.id)}>Open in Work Queue</Button>
        </div>
      )}
      {error && (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      )}

      {editing && worker && <PermissionDialog worker={worker} initialScope={op.requiredScope} onClose={() => setEditing(false)} />}

      {showReplay && selected && <IncidentReplay op={op} timeline={timeline} selectedSeq={selected.seq} onPick={setPickedSeq} />}

      <details className="card tech" open={!showReplay}>
        <summary>
          Technical record: events, the decision and the permissions it used
          <span className="chev">
            <Icon name="chevron" size={16} />
          </span>
        </summary>
      <div className="gov-grid">
        <Card title="What was recorded" subtitle="In order of record. Select an event to rebuild the permission state at that point." flush>
          <div style={{ padding: 'var(--s-2) var(--s-4) var(--s-4)' }}>
            <EventTimeline events={timeline} afterSeq={outcomeSeq} selectedSeq={selected?.seq} onSelect={(e) => setPickedSeq(e.seq)} />
          </div>
        </Card>

        <div className="gov-side">
          {isEval(selected) && verdict ? (
            <Card flush>
              <div className="verdict">
                <div className="verdict__head">
                  <div>
                    <div className={`verdict__word verdict__word--${selected.decision}`}>{selected.decision === 'allowed' ? 'Allowed' : 'Denied'}</div>
                    <div className="verdict__reason">{REASON_LABEL[selected.reasonCode]}</div>
                  </div>
                  <Button size="sm" onClick={copy}>
                    Copy evidence summary
                  </Button>
                </div>
                <p className="xs muted">
                  {op.status === 'executed' ? 'The action ran. ' : 'The action did not run. '}
                  Stored at execution time as event <span className="seq">#{selected.seq}</span>, {dateTime(selected.at)}, for {money(selected.amount)}.
                </p>

                <div className="tvn" role="group" aria-label="Then and now">
                  <div className="tvn__col">
                    <div className="section-label">Then</div>
                    <div className="tvn__state">
                      <StateLine state={selected.scopeState} granted={selected.evidenceChangeIds.length > 0} />
                    </div>
                    <div className="xs muted">
                      Log position <span className="seq">#{selected.cutoffSeq}</span>. The permission this decision relied on.
                    </div>
                  </div>
                  <div className="tvn__col">
                    <div className="section-label">Now</div>
                    <div className="tvn__state">
                      <StateLine state={verdict.live} granted={verdict.today.evidenceChangeIds.length > 0} />
                    </div>
                    <div className="xs muted">
                      Log position <span className="seq">#{state.nextSeq - 1}</span>. The same request today would be{' '}
                      <strong>{verdict.today.decision === 'allowed' ? 'allowed' : 'denied'}</strong>.
                    </div>
                  </div>
                </div>

                {verdict.changedSince.length === 0 ? (
                  <div className="alert alert--ok xs">No permission change was recorded after this decision. Today's permission agrees with it.</div>
                ) : (
                  <div className="alert alert--info xs standing">
                    <div>
                      <strong>This decision stands.</strong> {verdict.changedSince.length} permission{' '}
                      {verdict.changedSince.length === 1 ? 'change was' : 'changes were'} recorded after it. They never rewrite what was recorded.
                    </div>
                    <div className="chips">
                      {verdict.changedSince.map((c) => (
                        <button key={c.id} className="chip" onClick={() => setPickedSeq(c.seq)}>
                          #{c.seq} {c.action}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="verdict__proof">
                  <div>
                    <div className="section-label">Records this decision used</div>
                    {selected.evidenceChangeIds.length === 0 ? (
                      <div className="xs muted">No permission event exists for this scope.</div>
                    ) : (
                      <div className="chips">
                        {selected.evidenceChangeIds.map((id) => {
                          const ev = eventBySeq(id)
                          return (
                            <button key={id} className="chip" onClick={() => ev && setPickedSeq(ev.seq)}>
                              #{ev?.seq} {ev?.type === 'PermissionChanged' ? ev.action : ''}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="section-label">Re-check from the record</div>
                    {replayOk ? (
                      <Badge tone="ok" dot>
                        Verified
                      </Badge>
                    ) : (
                      <Badge tone="critical" dot>
                        Mismatch
                      </Badge>
                    )}
                    <div className="xs muted" style={{ marginTop: 4 }}>
                      Recomputed from the log, identical to the record.
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card title="Authorization decision" subtitle="Select an authorization event to see what it relied on, and how today differs.">
              {lastEval ? (
                <Button onClick={() => setPickedSeq(lastEval.seq)}>Jump to the decision</Button>
              ) : (
                <div className="small muted">No execution has been attempted yet, so there is no stored decision. The permission readings above are live, not recorded.</div>
              )}
            </Card>
          )}

          <Card
            title={isEval(selected) ? 'Permissions at the time' : `Permissions at event #${selected?.seq}`}
            subtitle={`${worker?.name}, rebuilt from permission events up to #${cutoff}. Later changes are not applied.`}
          >
            <PermissionsList
              events={state.events}
              workerId={op.workerId}
              cutoffSeq={cutoff}
              highlightScope={op.requiredScope}
              changedScope={selected?.type === 'PermissionChanged' ? selected.scope : undefined}
            />
          </Card>
        </div>
      </div>
      </details>
    </div>
  )
}
