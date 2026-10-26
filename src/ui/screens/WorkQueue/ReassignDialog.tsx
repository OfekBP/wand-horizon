import { useMemo, useState, type FormEvent } from 'react'
import type { Operation } from '../../../domain/types'
import { useNav } from '../../../state/nav'
import { useApp } from '../../../state/store'
import { Button } from '../../primitives/Button'
import { Overlay } from '../../primitives/Overlay'

export function ReassignDialog({ op, onClose }: { op: Operation; onClose: () => void }) {
  const { state, index, act } = useApp()
  const { notify } = useNav()
  const [ownerId, setOwnerId] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const current = index.workerById.get(op.decisionOwnerId)
  const groups = useMemo(
    () =>
      state.teams.map((t) => ({
        team: t,
        people: state.workers.filter((w) => w.kind === 'human' && w.teamId === t.id && w.id !== op.decisionOwnerId).sort((a, b) => a.name.localeCompare(b.name)),
      })),
    [state.teams, state.workers, op.decisionOwnerId],
  )

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const r = act({ type: 'REASSIGN_OWNER', operationId: op.id, newOwnerId: ownerId, reason })
    if (!r.ok) return setError(r.error)
    const to = r.state.workers.find((w) => w.id === ownerId)!.name
    notify(`Decision reassigned to ${to}. The operation is still awaiting approval.`, { label: 'View audit event', screen: 'governance', id: op.id })
    onClose()
  }

  return (
    <Overlay
      variant="dialog"
      title="Reassign pending decision"
      subtitle={op.title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="reassign-form" disabled={!ownerId || !reason.trim()}>
            Reassign decision
          </Button>
        </>
      }
    >
      <form id="reassign-form" onSubmit={submit} style={{ display: 'contents' }}>
        <div className="alert alert--info">
          Only the decision owner changes. The operation stays <strong>awaiting approval</strong>, and the reassignment is recorded in the audit log.
        </div>
        <div className="field">
          <span className="field__label">Current decision owner</span>
          <div className="small">
            {current?.name} · <span className="muted">{current?.role}</span>
          </div>
        </div>
        <div className="field">
          <label htmlFor="new-owner">New decision owner</label>
          <select id="new-owner" className="select" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} data-autofocus>
            <option value="">Select a person</option>
            {groups.map((g) => (
              <optgroup key={g.team.id} label={g.team.name}>
                {g.people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.role}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="reassign-reason">Reason</label>
          <textarea id="reassign-reason" className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is the decision moving?" />
          <span className="field__hint">Required. Shown in the audit history.</span>
        </div>
        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}
      </form>
    </Overlay>
  )
}
