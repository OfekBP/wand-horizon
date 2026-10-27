import { useMemo, useState } from 'react'
import { SCOPES } from '../../../domain/reducer'
import { caseRows, operationEvents } from '../../../domain/selectors'
import type { Operation } from '../../../domain/types'
import { useNav } from '../../../state/nav'
import { useApp } from '../../../state/store'
import { EventTimeline } from '../../audit/EventTimeline'
import { age, dateTime, money } from '../../format'
import { Badge, SeverityBadge, StatusBadge } from '../../primitives/Badge'
import { Button } from '../../primitives/Button'
import { Overlay } from '../../primitives/Overlay'
import { ReassignPanel } from './ReassignPanel'

export function OperationDrawer({ op, onClose }: { op: Operation; onClose: () => void }) {
  const { state, index } = useApp()
  const { go } = useNav()
  const [reassigning, setReassigning] = useState(false)
  const worker = index.workerById.get(op.workerId)
  const owner = index.workerById.get(op.decisionOwnerId)
  const team = worker ? index.teamById.get(worker.teamId) : undefined
  const events = operationEvents(state, op.id)
  const waiting = op.status === 'awaiting_approval'
  const row = useMemo(() => caseRows(state).find((r) => r.op.id === op.id), [state, op.id])
  const decided = row?.evaluation
  const tone = decided ? (decided.decision === 'allowed' ? 'ok' : 'critical') : row?.liveDecision?.decision === 'denied' ? 'critical' : 'neutral'

  return (
    <Overlay
      variant="drawer"
      title={op.title}
      subtitle={
        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
          <SeverityBadge severity={op.severity} />
          <StatusBadge status={op.status} />
        </span>
      }
      onClose={onClose}
      footer={
        <>
          <Button onClick={() => go('workforce', `op:${op.id}`)}>Show on the map</Button>
          <Button onClick={() => go('governance', op.id)}>Open the evidence</Button>
          {waiting && !reassigning && (
            <Button variant="primary" onClick={() => setReassigning(true)}>
              Reassign decision
            </Button>
          )}
        </>
      }
    >
      <p className="small">{op.summary}</p>
      {op.blockReason && waiting && (
        <div className="alert alert--warn">
          <strong>Why it is blocked:</strong> {op.blockReason}.
        </div>
      )}

      {reassigning && <ReassignPanel op={op} onDone={() => setReassigning(false)} />}

      <dl className="facts">
        <div>
          <dt>Approver</dt>
          <dd>
            {owner?.name}
            <div className="xs muted">{owner?.role}</div>
          </dd>
        </div>
        <div>
          <dt>{waiting ? 'Waiting' : 'Started'}</dt>
          <dd>
            {waiting ? age(op.awaitingSince ?? op.startedAt, state.clock) : dateTime(op.startedAt)}
            <div className="xs muted">since {dateTime(op.awaitingSince ?? op.startedAt)}</div>
          </dd>
        </div>
        <div>
          <dt>Executing AI worker</dt>
          <dd>
            <button className="link" onClick={() => worker && go('workforce', worker.id)}>
              {worker?.name}
            </button>
            <div className="xs muted">{team?.name}</div>
          </dd>
        </div>
        <div>
          <dt>Amount at stake</dt>
          <dd className="num">{money(op.amount)}</dd>
        </div>
      </dl>

      <section className="authority" aria-label="Authority">
        <div className="authority__head">
          <span className="section-label">Authority</span>
        </div>
        <div className="authority__body">
          <div>
            <div className="strong">{SCOPES[op.requiredScope]}</div>
            <div className="seq">{op.requiredScope}</div>
          </div>
          <div className="authority__note">
            {decided || row?.liveDecision ? (
              <Badge tone={tone} dot>
                {decided ? (decided.decision === 'allowed' ? 'Allowed' : 'Denied') : row?.liveDecision?.decision === 'denied' ? 'At risk' : 'Would be allowed'}
              </Badge>
            ) : (
              <Badge>Not executable</Badge>
            )}
            <div className="xs muted">{row?.authorityNote}</div>
          </div>
        </div>
        {row && row.changedDuringCase.length > 0 && (
          <div className="xs">
            {row.changedDuringCase.length} permission {row.changedDuringCase.length === 1 ? 'change' : 'changes'} for this worker and scope since this operation started.{' '}
            <button className="link" onClick={() => go('governance', op.id)}>
              Reconstruct
            </button>
          </div>
        )}
      </section>

      <div>
        <div className="section-label" style={{ marginBottom: 8 }}>
          History
        </div>
        <EventTimeline events={events} />
      </div>
    </Overlay>
  )
}
