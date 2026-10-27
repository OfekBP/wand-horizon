import { useMemo, useState } from 'react'
import { blockedOperations, openConcerns, openConflicts, SEVERITY_RANK } from '../../../domain/selectors'
import type { Conflict, Operation, PerformanceConcern } from '../../../domain/types'
import { useNav } from '../../../state/nav'
import { useApp } from '../../../state/store'
import { age, money } from '../../format'
import { Badge, SeverityBadge } from '../../primitives/Badge'
import { Card, PageHeader, Tabs } from '../../primitives/Layout'
import { DataTable, type Column } from '../../primitives/Table'
import { ConcernDrawer } from './ConcernDrawer'
import { ConflictDrawer } from './ConflictDrawer'
import { formatMetric } from './format'
import { OperationDrawer } from './OperationDrawer'
import './workqueue.css'

type Tab = 'blocked' | 'conflicts' | 'concerns'

const tabFor = (id: string | null): Tab | null =>
  !id ? null : id.startsWith('op-') ? 'blocked' : id.startsWith('pc-') ? 'concerns' : id.startsWith('c-') ? 'conflicts' : null

export function WorkQueue() {
  const { state, index } = useApp()
  const { selectedId, go } = useNav()
  const [chosenTab, setTab] = useState<Tab>('blocked')
  // A deep link or open item decides the tab; otherwise the user's last choice stands.
  const tab = tabFor(selectedId) ?? chosenTab
  const [showResolved, setShowResolved] = useState(false)

  const blocked = useMemo(() => blockedOperations(state), [state])
  const open = useMemo(() => openConflicts(state), [state])
  const concerns = useMemo(() => openConcerns(state), [state])
  const conflicts = useMemo(
    () =>
      showResolved
        ? [...state.conflicts].sort((a, b) => (a.status === b.status ? SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] : a.status === 'open' ? -1 : 1))
        : open,
    [showResolved, state.conflicts, open],
  )
  const lastSeq = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of state.events) if (e.operationId) m.set(e.operationId, e.seq)
    return m
  }, [state.events])
  const name = (id: string) => index.workerById.get(id)?.name ?? id
  const select = (id: string) => {
    setTab(tabFor(id) ?? chosenTab)
    go('queue', id)
  }
  const close = () => go('queue')

  const opColumns: Column<Operation>[] = [
    { key: 'sev', header: 'Severity', width: '110px', render: (o) => <SeverityBadge severity={o.severity} /> },
    {
      key: 'op',
      header: 'Operation',
      render: (o) => (
        <>
          <div className="cell-title">{o.title}</div>
          <div className="cell-sub">
            {name(o.workerId)} · {o.blockReason}
          </div>
        </>
      ),
    },
    { key: 'owner', header: 'Decision owner', render: (o) => name(o.decisionOwnerId) },
    { key: 'wait', header: 'Waiting', align: 'right', render: (o) => age(o.awaitingSince ?? o.startedAt, state.clock) },
    { key: 'amount', header: 'Amount', align: 'right', render: (o) => money(o.amount) },
    { key: 'seq', header: 'Last event', align: 'right', render: (o) => <span className="seq">#{lastSeq.get(o.id) ?? ''}</span> },
  ]

  const conflictColumns: Column<Conflict>[] = [
    { key: 'sev', header: 'Severity', width: '110px', render: (c) => <SeverityBadge severity={c.severity} /> },
    {
      key: 'res',
      header: 'Contested resource',
      render: (c) => (
        <>
          <div className="cell-title">{c.resource}</div>
          <div className="cell-sub">{c.summary}</div>
        </>
      ),
    },
    { key: 'workers', header: 'Workers', render: (c) => `${name(c.workerAId)} vs ${name(c.workerBId)}` },
    { key: 'open', header: 'Open for', align: 'right', render: (c) => age(c.detectedAt, c.resolution?.resolvedAt ?? state.clock) },
    { key: 'status', header: 'Status', render: (c) => <Badge tone={c.status === 'open' ? 'medium' : 'ok'}>{c.status === 'open' ? 'Open' : 'Resolved'}</Badge> },
  ]

  const concernColumns: Column<PerformanceConcern>[] = [
    { key: 'sev', header: 'Severity', width: '110px', render: (c) => <SeverityBadge severity={c.severity} /> },
    {
      key: 'w',
      header: 'AI worker',
      render: (c) => (
        <>
          <div className="cell-title">{name(c.workerId)}</div>
          <div className="cell-sub">{c.note}</div>
        </>
      ),
    },
    { key: 'metric', header: 'Metric', render: (c) => c.metric },
    { key: 'obs', header: 'Observed', align: 'right', render: (c) => <span className="strong">{formatMetric(c.observed, c.unit)}</span> },
    { key: 'thr', header: 'Threshold', align: 'right', render: (c) => formatMetric(c.threshold, c.unit) },
  ]

  const selOp = selectedId ? index.opById.get(selectedId) : undefined
  const selConflict = selectedId ? state.conflicts.find((c) => c.id === selectedId) : undefined
  const selConcern = selectedId ? state.concerns.find((c) => c.id === selectedId) : undefined

  return (
    <div className="page">
      <PageHeader title="Work Queue" subtitle="Operations waiting on a human decision, conflicts between workers, and performance concerns. Most severe first." />

      <Card flush>
        <div style={{ padding: '0 var(--s-5)' }}>
          <Tabs
            label="Work queue sections"
            value={tab}
            onChange={setTab}
            tabs={[
              { key: 'blocked', label: 'Blocked operations', count: blocked.length },
              { key: 'conflicts', label: 'Conflicts', count: open.length },
              { key: 'concerns', label: 'Performance concerns', count: concerns.length },
            ]}
          />
        </div>

        {tab === 'blocked' && (
          <DataTable
            label="Blocked operations"
            rows={blocked}
            columns={opColumns}
            rowKey={(o) => o.id}
            selectedKey={selectedId}
            onRowClick={(o) => select(o.id)}
            empty="No operations are waiting on a decision."
          />
        )}
        {tab === 'conflicts' && (
          <>
            <div className="toolbar">
              <span className="small muted">Two workers acting on the same resource. Resolve by choosing which one is authoritative.</span>
              <label className="check">
                <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
                Show resolved
              </label>
            </div>
            <DataTable
              label="Conflicts"
              rows={conflicts}
              columns={conflictColumns}
              rowKey={(c) => c.id}
              selectedKey={selectedId}
              onRowClick={(c) => select(c.id)}
              empty="No open conflicts."
            />
          </>
        )}
        {tab === 'concerns' && (
          <DataTable
            label="Performance concerns"
            rows={concerns}
            columns={concernColumns}
            rowKey={(c) => c.id}
            selectedKey={selectedId}
            onRowClick={(c) => select(c.id)}
            empty="No open performance concerns."
          />
        )}
      </Card>

      {selOp && <OperationDrawer key={selOp.id} op={selOp} onClose={close} />}
      {selConflict && <ConflictDrawer key={selConflict.id} conflict={selConflict} onClose={close} />}
      {selConcern && <ConcernDrawer key={selConcern.id} concern={selConcern} onClose={close} />}
    </div>
  )
}

