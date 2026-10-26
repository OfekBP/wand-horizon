import { useMemo, useState, type FormEvent } from 'react'
import { scopeStateAsOf } from '../../../domain/authorize'
import { SCOPES } from '../../../domain/reducer'
import type { PermissionAction, Worker } from '../../../domain/types'
import { useNav } from '../../../state/nav'
import { useApp } from '../../../state/store'
import { Button } from '../../primitives/Button'
import { Overlay } from '../../primitives/Overlay'
import { money } from '../../format'

export function PermissionDialog({ worker, initialScope, onClose }: { worker: Worker; initialScope?: string; onClose: () => void }) {
  const { state, act } = useApp()
  const { notify } = useNav()
  const touched = useMemo(() => [...new Set(state.events.filter((e) => e.type === 'PermissionChanged' && e.workerId === worker.id).map((e) => (e.type === 'PermissionChanged' ? e.scope : '')))], [state.events, worker.id])
  const [scope, setScope] = useState(initialScope ?? touched[0] ?? Object.keys(SCOPES)[0])
  const current = scopeStateAsOf(state.events, worker.id, scope, state.nextSeq - 1).state
  const actions: PermissionAction[] = current.active ? ['modify', 'revoke'] : ['grant']
  const [chosen, setChosen] = useState<PermissionAction | ''>('')
  const action = actions.includes(chosen as PermissionAction) ? (chosen as PermissionAction) : actions[0]
  const [limit, setLimit] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const needsLimit = action !== 'revoke'

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const parsed = limit.trim() === '' ? undefined : Number(limit.replace(/[,$\s]/g, ''))
    if (needsLimit && parsed !== undefined && !(parsed > 0)) return setError('Enter a positive limit, or leave blank for no limit.')
    if (action === 'modify' && parsed === undefined) return setError('Enter the new limit.')
    const r = act({ type: 'CHANGE_PERMISSION', workerId: worker.id, scope, action, limit: needsLimit ? parsed : undefined, reason })
    if (!r.ok) return setError(r.error)
    const verb = action === 'grant' ? 'granted' : action === 'modify' ? 'updated' : 'revoked'
    notify(`${SCOPES[scope]} ${verb} for ${worker.name}.`, { label: 'View audit event', screen: 'governance', id: `ev-${r.state.nextSeq - 1}` })
    onClose()
  }

  const LABEL: Record<PermissionAction, string> = { grant: 'Grant', modify: 'Change limit', revoke: 'Revoke' }

  return (
    <Overlay
      variant="dialog"
      title="Change permissions"
      subtitle={worker.name}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant={action === 'revoke' ? 'danger' : 'primary'} type="submit" form="perm-form" disabled={!reason.trim()}>
            {LABEL[action]}
          </Button>
        </>
      }
    >
      <form id="perm-form" onSubmit={submit} style={{ display: 'contents' }}>
        <div className="alert alert--info">
          Takes effect immediately. Any operation of this worker that has not executed yet is judged against the new permissions when it runs. Operations that already
          executed are not affected.
        </div>
        <div className="field">
          <label htmlFor="perm-scope">Permission</label>
          <select
            id="perm-scope"
            className="select"
            value={scope}
            onChange={(e) => {
              setScope(e.target.value)
              setChosen('')
              setError(null)
            }}
            data-autofocus
          >
            {Object.entries(SCOPES).map(([k, label]) => (
              <option key={k} value={k}>
                {label} ({k})
              </option>
            ))}
          </select>
          <span className="field__hint">{current.active ? `Currently active · ${current.limit !== undefined ? `limit ${money(current.limit)}` : 'no limit'}` : 'Currently not granted'}</span>
        </div>
        <div className="field">
          <span className="field__label">Change</span>
          <div className="choices" role="radiogroup" aria-label="Change">
            {actions.map((a) => (
              <label className="choice" key={a}>
                <input type="radio" name="perm-action" checked={action === a} onChange={() => setChosen(a)} />
                <span className="strong">{LABEL[a]}</span>
              </label>
            ))}
          </div>
        </div>
        {needsLimit && (
          <div className="field">
            <label htmlFor="perm-limit">{action === 'modify' ? 'New limit (USD)' : 'Limit (USD)'}</label>
            <input id="perm-limit" className="input num" inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder={action === 'grant' ? 'Leave blank for no limit' : 'e.g. 250000'} />
          </div>
        )}
        <div className="field">
          <label htmlFor="perm-reason">Reason</label>
          <textarea id="perm-reason" className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this changing?" />
          <span className="field__hint">Required. Recorded in the audit log.</span>
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
