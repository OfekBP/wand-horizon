import { useMemo, useState } from 'react'
import { describeEvent } from '../../../domain/audit'
import type { AuditEvent, AuthorizationEvaluatedEvent, Operation, OperationStatus } from '../../../domain/types'
import { useNav } from '../../../state/nav'
import { useApp } from '../../../state/store'
import { dateTime, money } from '../../format'
import { Badge, StatusBadge } from '../../primitives/Badge'
import { Button } from '../../primitives/Button'
import { Icon } from '../../primitives/Icon'
import { Card, PageHeader, Tabs } from '../../primitives/Layout'
import { DataTable, type Column } from '../../primitives/Table'
import { EventDrawer } from './EventDrawer'
import { OperationDetail } from './OperationDetail'
import './governance.css'
import '../Workforce/workforce.css'

type View = 'operations' | 'log'
const PAGE = 50

const TYPE_LABEL: Record<AuditEvent['type'], string> = {
  OperationStarted: 'Operation started',
  OwnerReassigned: 'Decision reassigned',
  ConflictResolved: 'Conflict resolved',
  PermissionChanged: 'Permission changed',
  AuthorizationEvaluated: 'Authorization evaluated',
  OperationExecuted: 'Operation executed',
  ExecutionPrevented: 'Execution prevented',
}

function Pager({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null
  return (
    <div className="pager">
      <span className="num">
        {page * PAGE + 1}–{Math.min(total, (page + 1) * PAGE)} of {total}
      </span>
      <div>
        <Button size="sm" disabled={page === 0} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button size="sm" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  )
}

export function Governance() {
  const { state, index } = useApp()
  const { selectedId, go } = useNav()
  const [view, setView] = useState<View>('operations')
  const [status, setStatus] = useState<'all' | OperationStatus>('all')
  const [q, setQ] = useState('')
  const [type, setType] = useState<'all' | AuditEvent['type']>('all')
  const [opPage, setOpPage] = useState(0)
  const [logPage, setLogPage] = useState(0)

  const nameOf = (id: string) => index.workerById.get(id)?.name ?? id

  /* resolve the deep link: an operation id, or an event id (which may belong to an operation) */
  const linkedEvent = selectedId?.startsWith('ev-') ? state.events.find((e) => e.id === selectedId) : undefined
  const detailOp = selectedId?.startsWith('op-') ? index.opById.get(selectedId) : linkedEvent?.operationId ? index.opById.get(linkedEvent.operationId) : undefined
  const drawerEvent = linkedEvent && !linkedEvent.operationId ? linkedEvent : undefined

  const byOp = useMemo(() => {
    const m = new Map<string, AuditEvent[]>()
    for (const e of state.events) if (e.operationId) m.set(e.operationId, [...(m.get(e.operationId) ?? []), e])
    return m
  }, [state.events])

  const ops = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return state.operations
      .filter((o) => (status === 'all' || o.status === status) && (needle === '' || o.title.toLowerCase().includes(needle) || nameOf(o.workerId).toLowerCase().includes(needle)))
      .sort((a, b) => (byOp.get(b.id)?.at(-1)?.seq ?? 0) - (byOp.get(a.id)?.at(-1)?.seq ?? 0))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.operations, byOp, status, q])

  const logRows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return [...state.events]
      .reverse()
      .filter((e) => (type === 'all' || e.type === type) && (needle === '' || e.actor.toLowerCase().includes(needle) || (e.workerId ? nameOf(e.workerId).toLowerCase().includes(needle) : false) || (e.operationId ? (index.opById.get(e.operationId)?.title.toLowerCase().includes(needle) ?? false) : false)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.events, type, q])

  if (detailOp)
    return <OperationDetail key={detailOp.id + (linkedEvent?.seq ?? '')} op={detailOp} initialSeq={linkedEvent?.seq} onBack={() => go('governance')} />

  const opColumns: Column<Operation>[] = [
    {
      key: 'op',
      header: 'Operation',
      render: (o) => (
        <>
          <div className="cell-title">{o.title}</div>
          <div className="cell-sub">{nameOf(o.workerId)}</div>
        </>
      ),
    },
    { key: 'status', header: 'Status', render: (o) => <StatusBadge status={o.status} /> },
    {
      key: 'auth',
      header: 'Authorization',
      render: (o) => {
        const ev = [...(byOp.get(o.id) ?? [])].reverse().find((e): e is AuthorizationEvaluatedEvent => e.type === 'AuthorizationEvaluated')
        return ev ? <Badge tone={ev.decision === 'allowed' ? 'ok' : 'critical'} dot>{ev.decision === 'allowed' ? 'Allowed' : 'Denied'}</Badge> : <span className="muted">Not evaluated</span>
      },
    },
    { key: 'amount', header: 'Amount', align: 'right', render: (o) => money(o.amount) },
    { key: 'last', header: 'Last activity', align: 'right', render: (o) => <span className="muted">{dateTime(byOp.get(o.id)?.at(-1)?.at ?? o.startedAt)}</span> },
  ]

  const logColumns: Column<AuditEvent>[] = [
    { key: 'seq', header: '#', align: 'right', width: '72px', render: (e) => e.seq },
    { key: 'time', header: 'Time', render: (e) => <span className="muted num">{dateTime(e.at)}</span> },
    { key: 'type', header: 'Event', render: (e) => <span className="strong">{describeEvent(e, nameOf).title}</span> },
    { key: 'actor', header: 'Actor', render: (e) => e.actor },
    {
      key: 'subject',
      header: 'Subject',
      render: (e) => (
        <>
          <div className="cell-title">{e.operationId ? index.opById.get(e.operationId)?.title : e.workerId ? nameOf(e.workerId) : ''}</div>
          {e.operationId && e.workerId && <div className="cell-sub">{nameOf(e.workerId)}</div>}
        </>
      ),
    },
  ]

  const opPages = Math.max(1, Math.ceil(ops.length / PAGE))
  const logPages = Math.max(1, Math.ceil(logRows.length / PAGE))

  return (
    <div className="page">
      <PageHeader title="Governance" subtitle="Operation histories, permission changes and authorization outcomes. The log is append-only: new events are added, existing ones are never changed." />
      <div className="alert alert--info policy">
        <Icon name="governance" size={18} />
        <div>
          <strong>Prototype policy.</strong> Authorization must be valid at the moment a consequential action executes. Revocation before execution prevents the action. This is a
          browser simulation and does not provide production-grade security.
        </div>
      </div>

      <Card flush>
        <div style={{ padding: '0 var(--s-5)' }}>
          <Tabs
            label="Governance views"
            value={view}
            onChange={(v) => {
              setView(v)
              setQ('')
            }}
            tabs={[
              { key: 'operations', label: 'Operations', count: state.operations.length },
              { key: 'log', label: 'Event log', count: state.events.length },
            ]}
          />
        </div>
        <div className="filters">
          <div className="search">
            <Icon name="search" size={16} />
            <input
              className="input"
              type="search"
              aria-label={view === 'operations' ? 'Search operations' : 'Search events'}
              placeholder={view === 'operations' ? 'Search operation or worker' : 'Search actor, worker or operation'}
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setOpPage(0)
                setLogPage(0)
              }}
            />
          </div>
          {view === 'operations' ? (
            <select className="select" aria-label="Status" value={status} onChange={(e) => (setStatus(e.target.value as typeof status), setOpPage(0))}>
              <option value="all">Any status</option>
              <option value="in_progress">In progress</option>
              <option value="awaiting_approval">Awaiting approval</option>
              <option value="executed">Executed</option>
              <option value="prevented">Prevented</option>
            </select>
          ) : (
            <select className="select" aria-label="Event type" value={type} onChange={(e) => (setType(e.target.value as typeof type), setLogPage(0))}>
              <option value="all">Any event</option>
              {Object.entries(TYPE_LABEL).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          )}
          <span className="filters__count num" aria-live="polite">
            {view === 'operations' ? `${ops.length} operations` : `${logRows.length} events`}
          </span>
        </div>

        {view === 'operations' ? (
          <>
            <DataTable label="Operations" rows={ops.slice(opPage * PAGE, opPage * PAGE + PAGE)} columns={opColumns} rowKey={(o) => o.id} onRowClick={(o) => go('governance', o.id)} empty="No operations match." />
            <Pager page={opPage} pages={opPages} total={ops.length} onPage={setOpPage} />
          </>
        ) : (
          <>
            <DataTable label="Event log" rows={logRows.slice(logPage * PAGE, logPage * PAGE + PAGE)} columns={logColumns} rowKey={(e) => e.id} selectedKey={drawerEvent?.id} onRowClick={(e) => go('governance', e.id)} empty="No events match." />
            <Pager page={logPage} pages={logPages} total={logRows.length} onPage={setLogPage} />
          </>
        )}
      </Card>

      {drawerEvent && <EventDrawer event={drawerEvent} onClose={() => go('governance')} />}
    </div>
  )
}
