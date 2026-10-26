import { useState, type FormEvent } from 'react'
import type { Conflict, Worker } from '../../../domain/types'
import { useNav } from '../../../state/nav'
import { useApp } from '../../../state/store'
import { age, dateTime } from '../../format'
import { Badge, SeverityBadge } from '../../primitives/Badge'
import { Button } from '../../primitives/Button'
import { Overlay } from '../../primitives/Overlay'

function WorkerCard({ worker, label }: { worker: Worker; label: string }) {
  const { state, index } = useApp()
  const { go } = useNav()
  const owner = worker.ownerId ? index.workerById.get(worker.ownerId) : undefined
  const active = state.operations.filter((o) => o.workerId === worker.id && (o.status === 'in_progress' || o.status === 'awaiting_approval')).length
  return (
    <div className="wcard">
      <span className="section-label">{label}</span>
      <span className="wcard__name">{worker.name}</span>
      <span className="xs muted">
        {index.teamById.get(worker.teamId)?.name} · owner {owner?.name ?? 'none'}
      </span>
      <ul>
        {worker.responsibilities.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <span className="xs muted">
        {active} active {active === 1 ? 'operation' : 'operations'}
      </span>
      <button className="link" onClick={() => go('workforce', worker.id)}>
        Open profile
      </button>
    </div>
  )
}

export function ConflictDrawer({ conflict, onClose }: { conflict: Conflict; onClose: () => void }) {
  const { state, index, act } = useApp()
  const { notify } = useNav()
  const [winner, setWinner] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const a = index.workerById.get(conflict.workerAId)!
  const b = index.workerById.get(conflict.workerBId)!
  const open = conflict.status === 'open'

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const r = act({ type: 'RESOLVE_CONFLICT', conflictId: conflict.id, authoritativeWorkerId: winner, note })
    if (!r.ok) return setError(r.error)
    const eventId = `ev-${r.state.nextSeq - 1}`
    notify(`Conflict resolved. ${index.workerById.get(winner)?.name} is now authoritative for this resource.`, { label: 'View audit event', screen: 'governance', id: eventId })
    onClose()
  }

  const resolvedBy = conflict.resolution
  return (
    <Overlay
      variant="drawer"
      title={`Conflict on ${conflict.resource}`}
      subtitle={
        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
          <SeverityBadge severity={conflict.severity} />
          <Badge tone={open ? 'medium' : 'ok'}>{open ? 'Open' : 'Resolved'}</Badge>
        </span>
      }
      onClose={onClose}
      footer={
        open ? (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" form="conflict-form" disabled={!winner || !note.trim()}>
              Resolve conflict
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Close</Button>
        )
      }
    >
      <p className="small">{conflict.summary}</p>
      <div className="xs muted">
        Detected {dateTime(conflict.detectedAt)} · open for {age(conflict.detectedAt, state.clock)}
      </div>

      <div className="pair">
        <WorkerCard worker={a} label="Worker A" />
        <WorkerCard worker={b} label="Worker B" />
      </div>

      {open ? (
        <form id="conflict-form" onSubmit={submit} style={{ display: 'contents' }}>
          <div className="field">
            <span className="field__label">Who is authoritative for this resource?</span>
            <div className="choices" role="radiogroup" aria-label="Authoritative worker">
              {[a, b].map((w) => (
                <label className="choice" key={w.id}>
                  <input type="radio" name="winner" value={w.id} checked={winner === w.id} onChange={() => setWinner(w.id)} data-autofocus={w === a || undefined} />
                  <span>
                    <span className="strong">{w.name}</span>
                    <span className="small muted" style={{ display: 'block' }}>
                      {winner === w.id ? `${(w === a ? b : a).name} stands down on this resource.` : 'Becomes the only worker allowed to change this resource.'}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="conflict-note">Resolution note</label>
            <textarea id="conflict-note" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this worker?" />
            <span className="field__hint">Required. Recorded in the audit log. Operation statuses are not changed by this decision.</span>
          </div>
          {error && (
            <div className="alert alert--error" role="alert">
              {error}
            </div>
          )}
        </form>
      ) : (
        resolvedBy && (
          <div className="alert alert--info">
            Resolved by <strong>{resolvedBy.resolvedBy}</strong> on {dateTime(resolvedBy.resolvedAt)}.{' '}
            <strong>{index.workerById.get(resolvedBy.authoritativeWorkerId)?.name}</strong> is authoritative. Note: {resolvedBy.note}
          </div>
        )
      )}
    </Overlay>
  )
}
