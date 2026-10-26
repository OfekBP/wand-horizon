import { useMemo, useState } from 'react'
import { classifyAiWorkers, filterWorkers, type WorkerFilter } from '../../../domain/selectors'
import type { Worker } from '../../../domain/types'
import { useNav } from '../../../state/nav'
import { useApp } from '../../../state/store'
import { money } from '../../format'
import { Badge } from '../../primitives/Badge'
import { Button } from '../../primitives/Button'
import { Icon } from '../../primitives/Icon'
import { Card, PageHeader } from '../../primitives/Layout'
import { DataTable, type Column } from '../../primitives/Table'
import { WorkerDrawer } from './WorkerDrawer'
import './workforce.css'

const PAGE = 50
const initials = (name: string) => name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()

export function Workforce() {
  const { state, index } = useApp()
  const { selectedId, go } = useNav()
  const [filter, setFilter] = useState<WorkerFilter>({ q: '', kind: 'all', teamId: 'all', status: 'all' })
  const [page, setPage] = useState(0)

  const patch = (p: Partial<WorkerFilter>) => {
    setFilter((f) => ({ ...f, ...p }))
    setPage(0)
  }

  const rows = useMemo(() => filterWorkers(state, filter), [state, filter])
  const classes = useMemo(() => classifyAiWorkers(state), [state])
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const current = Math.min(page, pages - 1)
  const visible = rows.slice(current * PAGE, current * PAGE + PAGE)

  const columns: Column<Worker>[] = [
    {
      key: 'name',
      header: 'Worker',
      render: (w) => (
        <div className="who">
          <span className={`avatar${w.kind === 'ai' ? ' avatar--ai' : ''}`} aria-hidden="true">
            {w.kind === 'ai' ? 'AI' : initials(w.name)}
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="cell-title">{w.name}</div>
            <div className="cell-sub">{w.role}</div>
          </div>
        </div>
      ),
    },
    { key: 'team', header: 'Team', render: (w) => index.teamById.get(w.teamId)?.name },
    { key: 'owner', header: 'Accountable owner', render: (w) => (w.ownerId ? index.workerById.get(w.ownerId)?.name : <span className="muted">None</span>) },
    {
      key: 'value',
      header: 'Value measurement',
      render: (w) => {
        if (w.kind === 'human') return <span className="muted">Not applicable</span>
        const c = classes.get(w.id)
        return (
          <span>
            <span className={`sw sw--${c === 'verified' ? 'verified' : c === 'estimatedOnly' ? 'estimated' : 'unmeasured'}`} />
            {c === 'verified' ? 'Verified' : c === 'estimatedOnly' ? 'Estimated only' : 'Unmeasured'}
          </span>
        )
      },
    },
    { key: 'status', header: 'Status', render: (w) => <Badge tone={w.status === 'active' ? 'ok' : 'medium'}>{w.status === 'active' ? 'Active' : 'Paused'}</Badge> },
    { key: 'cost', header: 'Monthly cost', align: 'right', render: (w) => money(w.monthlyCost) },
  ]

  const selected = selectedId ? index.workerById.get(selectedId) : undefined

  return (
    <div className="page">
      <PageHeader title="Workforce" subtitle={`${state.workers.filter((w) => w.kind === 'human').length} people and ${state.workers.filter((w) => w.kind === 'ai').length} AI workers. Every AI worker has an accountable human owner.`} />
      <Card flush>
        <div className="filters">
          <div className="search">
            <Icon name="search" size={16} />
            <input className="input" type="search" placeholder="Search name, role or ID" aria-label="Search workforce" value={filter.q} onChange={(e) => patch({ q: e.target.value })} />
          </div>
          <div className="seg" role="group" aria-label="Worker type">
            {([['all', 'All'], ['human', 'People'], ['ai', 'AI workers']] as const).map(([k, label]) => (
              <button key={k} aria-pressed={filter.kind === k} onClick={() => patch({ kind: k })}>
                {label}
              </button>
            ))}
          </div>
          <select className="select" aria-label="Team" value={filter.teamId} onChange={(e) => patch({ teamId: e.target.value })}>
            <option value="all">All teams</option>
            {state.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select className="select" aria-label="Status" value={filter.status} onChange={(e) => patch({ status: e.target.value as WorkerFilter['status'] })}>
            <option value="all">Any status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
          <span className="filters__count num" aria-live="polite">
            {rows.length} {rows.length === 1 ? 'worker' : 'workers'}
          </span>
        </div>
        <DataTable label="Workforce" rows={visible} columns={columns} rowKey={(w) => w.id} selectedKey={selectedId} onRowClick={(w) => go('workforce', w.id)} empty="No workers match these filters." />
        {pages > 1 && (
          <div className="pager">
            <span className="num">
              {current * PAGE + 1}–{Math.min(rows.length, (current + 1) * PAGE)} of {rows.length}
            </span>
            <div>
              <Button size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}>
                Previous
              </Button>
              <Button size="sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
      {selected && <WorkerDrawer key={selected.id} worker={selected} onClose={() => go('workforce')} />}
    </div>
  )
}
