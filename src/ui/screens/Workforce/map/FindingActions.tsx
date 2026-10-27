import { useState, type FormEvent } from 'react'
import { isUnavailable, span, suggestedDelegates, type Finding, type Reach } from '../../../../domain/findings'
import { useNav } from '../../../../state/nav'
import { useApp } from '../../../../state/store'
import { money } from '../../../format'
import { Button } from '../../../primitives/Button'
import { PermissionDialog } from '../PermissionDialog'

/** What the user did and what changed, shown in the panel once a finding is resolved. */
export interface Resolution {
  findingId: string
  /** Kept so the camera stays on the cluster that was just resolved. */
  reach: Reach
  title: string
  body: string
  /** Where the audit event can be read. */
  govId: string
  seq: number
}

interface Props {
  finding: Finding
  onResolved: (r: Resolution) => void
}

function Errors({ error }: { error: string | null }) {
  return error ? (
    <div className="alert alert--error" role="alert">
      {error}
    </div>
  ) : null
}

/** Moves a blocked decision to someone who can actually take it. */
function BlockedActions({ finding, onResolved }: Props) {
  const { state, index, act } = useApp()
  const op = state.operations.find((o) => o.id === finding.reach.opIds[0])!
  const owner = index.workerById.get(op.decisionOwnerId)!
  const delegates = suggestedDelegates(state, op)
  const [to, setTo] = useState(delegates[0]?.id ?? '')
  const [reason, setReason] = useState(
    `${owner.name} is out of office${owner.availability?.until ? ` until ${owner.availability.until.slice(0, 10)}` : ''}. Moving the decision so ${op.title} is not held past its deadline.`,
  )
  const [error, setError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const r = act({ type: 'REASSIGN_OWNER', operationId: op.id, newOwnerId: to, reason })
    if (!r.ok) return setError(r.error)
    const next = r.state.workers.find((w) => w.id === to)!
    onResolved({
      findingId: finding.id,
      reach: finding.reach,
      title: `Decision moved to ${next.name}`,
      body: `${op.title} now waits on ${next.name}, who is available.${op.dueAt ? ` It is due in ${span(r.state.clock, op.dueAt)}.` : ''} It is still awaiting approval: someone has to take the decision.`,
      govId: `ev-${r.state.nextSeq - 1}`,
      seq: r.state.nextSeq - 1,
    })
  }

  return (
    <form className="decide" onSubmit={submit} aria-label="Reassign the blocked decision">
      <div className="field">
        <span className="field__label">Who can take this decision?</span>
        <div className="choices" role="radiogroup" aria-label="New approver">
          {delegates.map((d) => (
            <label className="choice" key={d.id}>
              <input type="radio" name="delegate" value={d.id} checked={to === d.id} onChange={() => setTo(d.id)} />
              <span>
                <span className="strong">{d.name}</span>
                <span className="small muted" style={{ display: 'block' }}>
                  {d.role} · {index.teamById.get(d.teamId)?.name} · available
                </span>
              </span>
            </label>
          ))}
        </div>
        {delegates.length === 0 && <span className="field__hint">Nobody else is available.</span>}
      </div>
      <div className="field">
        <label htmlFor="blocked-reason">Reason</label>
        <textarea id="blocked-reason" className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} />
        <span className="field__hint">Recorded in the audit log.</span>
      </div>
      <Errors error={error} />
      <Button variant="primary" type="submit" disabled={!to || !reason.trim() || isUnavailable(index.workerById.get(to))}>
        Move the decision
      </Button>
    </form>
  )
}

/** Picks which of two workers is authoritative for the contested resource. */
function ConflictActions({ finding, onResolved }: Props) {
  const { state, index, act } = useApp()
  const conflict = state.conflicts.find((c) => c.id === finding.reach.conflictIds[0])!
  const a = index.workerById.get(conflict.workerAId)!
  const b = index.workerById.get(conflict.workerBId)!
  const duplicate = conflict.kind === 'duplicate'
  const [winner, setWinner] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const r = act({ type: 'RESOLVE_CONFLICT', conflictId: conflict.id, authoritativeWorkerId: winner, note })
    if (!r.ok) return setError(r.error)
    const w = winner === a.id ? a : b
    const other = winner === a.id ? b : a
    onResolved({
      findingId: finding.id,
      reach: finding.reach,
      title: duplicate ? `${w.name} keeps the work` : `${w.name} is now authoritative`,
      body: `${other.name} stands down on ${conflict.resource}. The conflict is closed and no longer drawn on the map.`,
      govId: `ev-${r.state.nextSeq - 1}`,
      seq: r.state.nextSeq - 1,
    })
  }

  return (
    <form className="decide" onSubmit={submit} aria-label="Resolve the conflict">
      <div className="field">
        <span className="field__label">{duplicate ? 'Which worker keeps this work?' : 'Which worker is authoritative?'}</span>
        <div className="choices" role="radiogroup" aria-label="Authoritative worker">
          {[a, b].map((w) => (
            <label className="choice" key={w.id}>
              <input type="radio" name="authoritative" value={w.id} checked={winner === w.id} onChange={() => setWinner(w.id)} />
              <span>
                <span className="strong">{w.name}</span>
                <span className="small muted" style={{ display: 'block' }}>
                  {winner === w.id ? `${(w === a ? b : a).name} stands down on this resource.` : `${w.role} · answers to ${index.workerById.get(w.ownerId ?? '')?.name ?? 'nobody'}`}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>
      <div className="field">
        <label htmlFor="conflict-note-map">Resolution note</label>
        <textarea id="conflict-note-map" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this worker?" />
        <span className="field__hint">Recorded in the audit log.</span>
      </div>
      <Errors error={error} />
      <Button variant="primary" type="submit" disabled={!winner || !note.trim()}>
        Resolve the conflict
      </Button>
    </form>
  )
}

/** Pauses workers whose modeled cost rose with nothing verified to show for it. */
function CostActions({ finding, onResolved }: Props) {
  const { state, act } = useApp()
  const workers = state.workers.filter((w) => finding.reach.workerIds.includes(w.id))
  const saved = workers.reduce((a, w) => a + w.monthlyCost, 0)
  const [reason, setReason] = useState('Modeled run cost rose with no verified value. Pausing until the owner can show confirmed outcomes.')
  const [error, setError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const r = act({ type: 'PAUSE_WORKERS', workerIds: finding.reach.workerIds, reason })
    if (!r.ok) return setError(r.error)
    onResolved({
      findingId: finding.id,
      reach: finding.reach,
      title: `${workers.length} workers paused`,
      body: `Modeled run-rate is down ${money(saved)} per month. The workers are drawn as paused and no longer counted as active.`,
      govId: `ev-${r.state.nextSeq - 1}`,
      seq: r.state.nextSeq - 1,
    })
  }

  return (
    <form className="decide" onSubmit={submit} aria-label="Pause the workers">
      <p className="small">
        Pausing {workers.length} workers removes <strong>{money(saved)}</strong> per month from the modeled run-rate. Their estimates stay on file; nothing verified is lost.
      </p>
      <div className="field">
        <label htmlFor="cost-reason">Reason</label>
        <textarea id="cost-reason" className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} />
        <span className="field__hint">Recorded in the audit log.</span>
      </div>
      <Errors error={error} />
      <Button variant="primary" type="submit" disabled={!reason.trim()}>
        Pause {workers.length} workers
      </Button>
    </form>
  )
}

/** Authority at risk is decided in permissions and in the evidence, so the actions go there. */
function AuthorityActions({ finding }: Props) {
  const { state, index } = useApp()
  const { go } = useNav()
  const [editing, setEditing] = useState(false)
  const op = state.operations.find((o) => o.id === finding.reach.opIds[0])!
  const worker = index.workerById.get(op.workerId)!
  return (
    <div className="decide">
      <p className="small">Restore the authority this operation needs, or leave it and let execution be prevented. Either way the decision is recorded when it runs.</p>
      <div className="decide__row">
        <Button variant="primary" onClick={() => setEditing(true)}>
          Change {worker.name}’s permission
        </Button>
        <Button onClick={() => go('governance', op.id)}>Open the evidence</Button>
      </div>
      {editing && <PermissionDialog worker={worker} initialScope={op.requiredScope} onClose={() => setEditing(false)} />}
    </div>
  )
}

export function FindingActions(props: Props) {
  switch (props.finding.kind) {
    case 'blocked-decision':
      return <BlockedActions {...props} />
    case 'conflicting-objectives':
    case 'duplicate-work':
      return <ConflictActions {...props} />
    case 'cost-without-proof':
      return <CostActions {...props} />
    case 'authority-at-risk':
      return <AuthorityActions {...props} />
  }
}
