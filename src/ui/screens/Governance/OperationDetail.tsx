import { useMemo, useState } from 'react'
import { REASON_LABEL } from '../../../domain/audit'
import { replayMatches, scopeStateAsOf } from '../../../domain/authorize'
import { SCOPES } from '../../../domain/reducer'
import { operationOutcomeSeq, operationTimeline } from '../../../domain/selectors'
import type { AuditEvent, AuthorizationEvaluatedEvent, Operation } from '../../../domain/types'
import { useNav } from '../../../state/nav'
import { useApp } from '../../../state/store'
import { EventTimeline } from '../../audit/EventTimeline'
import { dateTime, money } from '../../format'
import { Badge, SeverityBadge, StatusBadge } from '../../primitives/Badge'
import { Button } from '../../primitives/Button'
import { Icon } from '../../primitives/Icon'
import { Card } from '../../primitives/Layout'
import { PermissionsList } from '../Workforce/PermissionsList'
import './governance.css'

const isEval = (e: AuditEvent | undefined): e is AuthorizationEvaluatedEvent => e?.type === 'AuthorizationEvaluated'

export function OperationDetail({ op, initialSeq, onBack }: { op: Operation; initialSeq?: number; onBack: () => void }) {
  const { state, index, act } = useApp()
  const { go, notify } = useNav()
  const [error, setError] = useState<string | null>(null)

  const timeline = useMemo(() => operationTimeline(state, op), [state, op])
  const opEvents = useMemo(() => timeline.filter((e) => e.operationId === op.id), [timeline, op.id])
  const outcomeSeq = operationOutcomeSeq(opEvents)
  const lastEval = [...opEvents].reverse().find(isEval)
  const [pickedSeq, setPickedSeq] = useState<number | null>(initialSeq ?? null)
  const selected = timeline.find((e) => e.seq === pickedSeq) ?? lastEval ?? timeline[timeline.length - 1]

  const worker = index.workerById.get(op.workerId)
  const owner = index.workerById.get(op.decisionOwnerId)
  const nameOfEvent = (id: string) => timeline.find((e) => e.id === id)

  const cutoff = isEval(selected) ? selected.cutoffSeq : selected?.seq ?? state.nextSeq - 1
  const live = scopeStateAsOf(state.events, op.workerId, op.requiredScope, state.nextSeq - 1).state

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

  return (
    <div className="page">
      <div className="gov-head">
        <button className="crumb" onClick={onBack}>
          <Icon name="arrow" size={14} /> All operations
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
            <dt>Decision owner</dt>
            <dd>{owner?.name}</dd>
          </div>
          <div>
            <dt>Amount at stake</dt>
            <dd className="num">{money(op.amount)}</dd>
          </div>
          <div>
            <dt>Authority required</dt>
            <dd>
              {SCOPES[op.requiredScope]}
              <div className="xs muted mono">{op.requiredScope}</div>
            </dd>
          </div>
          <div>
            <dt>Started</dt>
            <dd>{dateTime(op.startedAt)}</dd>
          </div>
        </dl>
      </Card>

      {op.status === 'in_progress' && (
        <div className="alert alert--info policy">
          <div style={{ flex: 1 }}>
            <strong>Execution is pending.</strong> Running the execution step judges authorization at this moment, using the permissions in force right now.
            <div className="xs" style={{ marginTop: 4 }}>
              Current permission for this scope (not a recorded decision):{' '}
              {live.active ? `active · ${live.limit !== undefined ? `limit ${money(live.limit)}` : 'no limit'}` : 'not active'}.
            </div>
          </div>
          <Button variant="primary" onClick={run}>
            Run execution step
          </Button>
        </div>
      )}
      {op.status === 'awaiting_approval' && (
        <div className="alert alert--warn policy">
          <div style={{ flex: 1 }}>
            <strong>Awaiting a human decision.</strong> This operation cannot be executed. The prototype does not simulate the approval step; it demonstrates permission
            changes ahead of an execution attempt.
          </div>
          <Button onClick={() => go('queue', op.id)}>Open in Work Queue</Button>
        </div>
      )}
      {(op.status === 'executed' || op.status === 'prevented') && (
        <div className={`alert ${op.status === 'executed' ? 'alert--info' : 'alert--error'}`}>
          {op.status === 'executed' ? (
            <>
              <strong>Executed.</strong> Authorization was valid when the action ran. Later permission changes do not alter this outcome.
            </>
          ) : (
            <>
              <strong>Prevented.</strong> Authorization was not valid when the action was attempted, so it did not run.
            </>
          )}
        </div>
      )}
      {error && (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      )}

      <div className="gov-grid">
        <Card title="Event sequence" subtitle="Ordered by sequence number. Select an event to reconstruct the permission state." flush>
          <div style={{ padding: 'var(--s-2) var(--s-4) var(--s-4)' }}>
            <EventTimeline events={timeline} afterSeq={outcomeSeq} selectedSeq={selected?.seq} onSelect={(e) => setPickedSeq(e.seq)} />
          </div>
        </Card>

        <div className="gov-side">
          {isEval(selected) ? (
            <Card
              title={selected.decision === 'allowed' ? 'Authorization allowed' : 'Authorization denied'}
              subtitle="The decision as recorded at the moment of execution."
            >
              <dl className="decision-grid">
                <dt>Outcome</dt>
                <dd>
                  <Badge tone={selected.decision === 'allowed' ? 'ok' : 'critical'} dot>
                    {selected.decision === 'allowed' ? 'Allowed' : 'Denied'}
                  </Badge>
                </dd>
                <dt>Reason</dt>
                <dd>{REASON_LABEL[selected.reasonCode]}</dd>
                <dt>Evaluated</dt>
                <dd className="num">
                  {dateTime(selected.at)} · event #{selected.seq}
                </dd>
                <dt>Amount</dt>
                <dd className="num">{money(selected.amount)}</dd>
                <dt>State relied on</dt>
                <dd>
                  {selected.scopeState.active
                    ? `Active · ${selected.scopeState.limit !== undefined ? `limit ${money(selected.scopeState.limit)}` : 'no limit'}`
                    : selected.evidenceChangeIds.length === 0
                      ? 'Never granted'
                      : 'Revoked'}
                </dd>
                <dt>Read events up to</dt>
                <dd className="num">#{selected.cutoffSeq}</dd>
                <dt>Evidence</dt>
                <dd>
                  {selected.evidenceChangeIds.length === 0 ? (
                    <span className="muted">No permission events exist for this scope.</span>
                  ) : (
                    <div className="chips">
                      {selected.evidenceChangeIds.map((id) => {
                        const ev = nameOfEvent(id)
                        return (
                          <button key={id} className="chip" onClick={() => ev && setPickedSeq(ev.seq)}>
                            #{ev?.seq} {ev?.type === 'PermissionChanged' ? ev.action : ''}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </dd>
                <dt>Replay check</dt>
                <dd>
                  {replayMatches(state.events, selected) ? (
                    <span className="verify">
                      <Badge tone="ok" dot>
                        Matches
                      </Badge>
                      <span className="xs muted">Recomputed from the log, identical to the record.</span>
                    </span>
                  ) : (
                    <Badge tone="critical" dot>
                      Mismatch
                    </Badge>
                  )}
                </dd>
              </dl>
            </Card>
          ) : (
            <Card title="Authorization decision" subtitle="Select an authorization event in the sequence to see what it relied on.">
              {lastEval ? (
                <Button onClick={() => setPickedSeq(lastEval.seq)}>Jump to the decision</Button>
              ) : (
                <div className="small muted">No execution has been attempted yet, so there is no decision to reconstruct.</div>
              )}
            </Card>
          )}

          <Card
            title={isEval(selected) ? `Permissions this decision relied on` : `Permissions at event #${selected?.seq}`}
            subtitle={`${worker?.name} · reconstructed from permission events up to #${cutoff}. Later changes are not applied.`}
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
    </div>
  )
}
