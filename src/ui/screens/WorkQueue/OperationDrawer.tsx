import { useState } from 'react'
import { SCOPES } from '../../../domain/reducer'
import { operationEvents } from '../../../domain/selectors'
import type { Operation } from '../../../domain/types'
import { useNav } from '../../../state/nav'
import { useApp } from '../../../state/store'
import { EventTimeline } from '../../audit/EventTimeline'
import { age, dateTime, money } from '../../format'
import { SeverityBadge, StatusBadge } from '../../primitives/Badge'
import { Button } from '../../primitives/Button'
import { Overlay } from '../../primitives/Overlay'
import { ReassignDialog } from './ReassignDialog'

export function OperationDrawer({ op, onClose }: { op: Operation; onClose: () => void }) {
  const { state, index } = useApp()
  const { go } = useNav()
  const [reassigning, setReassigning] = useState(false)
  const worker = index.workerById.get(op.workerId)
  const owner = index.workerById.get(op.decisionOwnerId)
  const team = worker ? index.teamById.get(worker.teamId) : undefined
  const events = operationEvents(state, op.id)
  const waiting = op.status === 'awaiting_approval'

  return (
    <>
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
            <Button onClick={() => go('governance', op.id)}>Open full history</Button>
            {waiting && (
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

        <dl className="facts">
          <div>
            <dt>Decision owner</dt>
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
          <div>
            <dt>Authority required</dt>
            <dd>
              {SCOPES[op.requiredScope]}
              <div className="xs muted mono">{op.requiredScope}</div>
            </dd>
          </div>
          <div>
            <dt>Operation</dt>
            <dd className="mono">{op.id}</dd>
          </div>
        </dl>

        <div>
          <div className="section-label" style={{ marginBottom: 8 }}>
            History
          </div>
          <EventTimeline events={events} />
        </div>
      </Overlay>
      {reassigning && <ReassignDialog op={op} onClose={() => setReassigning(false)} />}
    </>
  )
}
