import { useMemo, useState } from 'react'
import { findings } from '../../../domain/findings'
import { classifyAiWorkers, filterWorkers, openConcerns, openConflicts, overviewMetrics, type WorkerFilter } from '../../../domain/selectors'
import type { Worker } from '../../../domain/types'
import { useNav } from '../../../state/navContext'
import { useApp } from '../../../state/appContext'
import { money, pct } from '../../format'
import { Badge } from '../../primitives/Badge'
import { Button } from '../../primitives/Button'
import { Icon } from '../../primitives/Icon'
import { Card, PageHeader, Tabs } from '../../primitives/Layout'
import { DataTable, type Column } from '../../primitives/Table'
import { MapView } from './map/MapView'
import { WorkerDrawer } from './WorkerDrawer'
import './workforce.css'

const PAGE = 50
const initials = (name: string) => name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()

function Registry() {
  const { state, index } = useApp()
  const [openId, setOpenId] = useState<string | null>(null)
  // The 500 AI workers are the registry's bulk, so they lead; people are one click away.
  const [filter, setFilter] = useState<WorkerFilter>({ q: '', kind: 'ai', teamId: 'all', status: 'all', value: 'all' })
  const [page, setPage] = useState(0)
  const metrics = useMemo(() => overviewMetrics(state), [state])
  const summary = useMemo(() => {
    const ai = state.workers.filter((w) => w.kind === 'ai')
    const owners = new Set(ai.map((w) => w.ownerId).filter(Boolean)).size
    const inConflict = new Set(openConflicts(state).flatMap((c) => [c.workerAId, c.workerBId])).size
    const withConcern = new Set(openConcerns(state).map((c) => c.workerId)).size
    return { owners, inConflict, withConcern }
  }, [state])

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
        <div className="person">
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
        if (w.kind === 'human') return <span className="muted" aria-label="Not applicable to people">—</span>
        const c = classes.get(w.id)
        return (
          <span>
            <span className={`sw sw--${c === 'verified' ? 'verified' : c === 'estimatedOnly' ? 'estimated' : 'unmeasured'}`} />
            {c === 'verified' ? 'Verified' : c === 'estimatedOnly' ? 'Estimated only' : 'Unmeasured'}
          </span>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (w) =>
        w.availability?.status === 'out_of_office' ? <Badge tone="high" dot>Out of office</Badge> : <Badge tone={w.status === 'active' ? 'ok' : 'medium'}>{w.status === 'active' ? 'Active' : 'Paused'}</Badge>,
    },
    { key: 'cost', header: 'Monthly cost', align: 'right', render: (w) => money(w.monthlyCost) },
  ]

  const opened = openId ? index.workerById.get(openId) : undefined

  return (
    <>
      <p className="small muted">
        <strong className="num">{metrics.aiWorkers}</strong> AI workers answer to <strong className="num">{summary.owners}</strong> accountable people ·{' '}
        <strong className="num">{pct(metrics.coverage, 1)}</strong> have verified value · <strong className="num">{summary.inConflict}</strong> are in an open conflict ·{' '}
        <strong className="num">{summary.withConcern}</strong> have an open performance concern.
      </p>
      <Card flush>
        <div className="filters">
          <div className="search">
            <Icon name="search" size={16} />
            <input className="input" type="search" placeholder="Search name, role or ID" aria-label="Search workforce" value={filter.q} onChange={(e) => patch({ q: e.target.value })} />
          </div>
          <div className="seg" role="group" aria-label="Worker type">
            {([['ai', 'AI workers'], ['human', 'People'], ['all', 'All']] as const).map(([k, label]) => (
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
          <select className="select" aria-label="Value measurement" value={filter.value} onChange={(e) => patch({ value: e.target.value as WorkerFilter['value'] })}>
            <option value="all">Any value measurement</option>
            <option value="verified">Verified</option>
            <option value="estimatedOnly">Estimated only</option>
            <option value="unmeasured">Unmeasured</option>
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
        <DataTable label="Workforce registry" rows={visible} columns={columns} rowKey={(w) => w.id} selectedKey={openId} onRowClick={(w) => setOpenId(w.id)} empty="No workers match these filters." />
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
      {opened && <WorkerDrawer key={opened.id} worker={opened} onClose={() => setOpenId(null)} />}
    </>
  )
}

export function Workforce() {
  const { state } = useApp()
  const { selectedId, go } = useNav()
  const view = selectedId === 'registry' ? 'registry' : 'map'
  const open = useMemo(() => findings(state).length, [state])
  const people = state.workers.filter((w) => w.kind === 'human').length
  const aiCount = state.workers.filter((w) => w.kind === 'ai').length

  return (
    <div className="page">
      <PageHeader
        title="The whole workforce,"
        accent="at a glance"
        subtitle={`Use this to see who owns what: ${people} people and ${aiCount} AI workers, with every AI worker shown under the person accountable for it. Problems are listed on the left; pick one to see why it matters and decide.`}
      />
      <Tabs
        label="Workforce views"
        value={view}
        onChange={(v) => go('workforce', v === 'registry' ? 'registry' : null)}
        tabs={[
          { key: 'map', label: 'Map', count: open },
          { key: 'registry', label: 'Registry', count: people + aiCount },
        ]}
      />
      {view === 'map' ? <MapView /> : <Registry />}
    </div>
  )
}
