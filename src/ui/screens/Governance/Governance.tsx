import { useMemo, useState } from 'react'
import { describeEvent } from '../../../domain/audit'
import { caseRows, governanceStats, inSegment, type CaseRow, type CaseSegment } from '../../../domain/selectors'
import type { AuditEvent } from '../../../domain/types'
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
import './replay.css'
import '../Workforce/workforce.css'

type View = 'cases' | 'log'
const PAGE = 50
/** The seeded story that walks through the whole scenario: authority changed mid-flight, then attempted. */
const FEATURED_INCIDENT = 'op-d1'
const WINDOW_DAYS = 30

const TYPE_LABEL: Record<AuditEvent['type'], string> = {
  OperationStarted: 'Operation started',
  OwnerReassigned: 'Decision reassigned',
  ConflictResolved: 'Conflict resolved',
  PermissionChanged: 'Permission changed',
  AuthorizationEvaluated: 'Authorization evaluated',
  OperationExecuted: 'Operation executed',
  ExecutionPrevented: 'Execution prevented',
  WorkersPaused: 'Workers paused',
}

const SEGMENTS: Array<{ key: CaseSegment; label: string; help: string }> = [
  { key: 'changed', label: 'Authority changed', help: 'A permission for this worker and scope was changed after the operation started. These are the cases worth reconstructing.' },
  { key: 'prevented', label: 'Prevented', help: 'Execution was attempted and denied. Each has a stored decision and the permission events it relied on.' },
  { key: 'executed', label: 'Executed', help: 'Authorized at the moment they ran. Later permission changes never rewrite these.' },
  { key: 'open', label: 'Open', help: 'In progress or waiting on a human. No decision is stored until an in-progress operation runs.' },
  { key: 'all', label: 'All cases', help: 'Every operation in the log.' },
]

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
  const [view, setView] = useState<View>('cases')
  const [segment, setSegment] = useState<CaseSegment>('changed')
  const [q, setQ] = useState('')
  const [type, setType] = useState<'all' | AuditEvent['type']>('all')
  const [casePage, setCasePage] = useState(0)
  const [logPage, setLogPage] = useState(0)

  const nameOf = (id: string) => index.workerById.get(id)?.name ?? id
  const featured = index.opById.get(FEATURED_INCIDENT)

  /* resolve the deep link: an operation id, or an event id (which may belong to an operation) */
  const linkedEvent = selectedId?.startsWith('ev-') ? state.events.find((e) => e.id === selectedId) : undefined
  const detailOp = selectedId?.startsWith('op-') ? index.opById.get(selectedId) : linkedEvent?.operationId ? index.opById.get(linkedEvent.operationId) : undefined
  const drawerEvent = linkedEvent && !linkedEvent.operationId ? linkedEvent : undefined

  const rows = useMemo(() => caseRows(state), [state])
  const lastSeq = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of state.events) if (e.operationId) m.set(e.operationId, e.seq)
    return m
  }, [state.events])
  const since = useMemo(() => new Date(Date.parse(state.seedClock) - WINDOW_DAYS * 86_400_000).toISOString(), [state.seedClock])
  const stats = useMemo(() => governanceStats(state, since), [state, since])

  const counts = useMemo(() => Object.fromEntries(SEGMENTS.map((s) => [s.key, rows.filter((r) => inSegment(r, s.key)).length])) as Record<CaseSegment, number>, [rows])
  const cases = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows
      .filter((r) => inSegment(r, segment) && (needle === '' || r.op.title.toLowerCase().includes(needle) || nameOf(r.op.workerId).toLowerCase().includes(needle)))
      .sort((a, b) => (lastSeq.get(b.op.id) ?? 0) - (lastSeq.get(a.op.id) ?? 0))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, segment, q, lastSeq])

  const logRows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return [...state.events]
      .reverse()
      .filter(
        (e) =>
          (type === 'all' || e.type === type) &&
          (needle === '' ||
            e.actor.toLowerCase().includes(needle) ||
            (e.workerId ? nameOf(e.workerId).toLowerCase().includes(needle) : false) ||
            (e.operationId ? (index.opById.get(e.operationId)?.title.toLowerCase().includes(needle) ?? false) : false)),
      )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.events, type, q])

  if (detailOp) return <OperationDetail key={detailOp.id + (linkedEvent?.seq ?? '')} op={detailOp} initialSeq={linkedEvent?.seq} onBack={() => go('governance')} />

  const caseColumns: Column<CaseRow>[] = [
    {
      key: 'op',
      header: 'Case',
      render: (r) => (
        <>
          <div className="cell-title">{r.op.title}</div>
          <div className="cell-sub">
            {nameOf(r.op.workerId)}
            {r.changedDuringCase.length > 0 && ` · ${r.changedDuringCase.length} permission ${r.changedDuringCase.length === 1 ? 'change' : 'changes'} during the case`}
          </div>
        </>
      ),
    },
    {
      key: 'authority',
      header: 'Authority',
      render: (r) => {
        const tone = r.evaluation ? (r.evaluation.decision === 'allowed' ? 'ok' : 'critical') : r.liveDecision?.decision === 'denied' ? 'critical' : 'neutral'
        const label = r.evaluation ? (r.evaluation.decision === 'allowed' ? 'Allowed' : 'Denied') : r.liveDecision?.decision === 'denied' ? 'At risk' : r.op.status === 'in_progress' ? 'Not yet decided' : 'Not executable'
        return (
          <>
            <Badge tone={tone} dot>
              {label}
            </Badge>
            <div className="cell-sub" style={{ marginTop: 3 }}>
              {r.authorityNote}
            </div>
          </>
        )
      },
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.op.status} /> },
    { key: 'owner', header: 'Decision owner', render: (r) => nameOf(r.op.decisionOwnerId) },
    { key: 'amount', header: 'Amount', align: 'right', render: (r) => money(r.op.amount) },
    {
      key: 'last',
      header: 'Last event',
      align: 'right',
      render: (r) => {
        const seq = lastSeq.get(r.op.id)
        const at = state.events.find((e) => e.seq === seq)?.at
        return (
          <>
            <div className="num" style={{ whiteSpace: 'nowrap' }}>
              {at ? dateTime(at).replace(' UTC', '') : ''}
            </div>
            <div className="seq">#{seq ?? ''}</div>
          </>
        )
      },
    },
  ]

  const logColumns: Column<AuditEvent>[] = [
    { key: 'seq', header: 'Seq', width: '84px', render: (e) => <span className="seq">#{e.seq}</span> },
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

  const casePages = Math.max(1, Math.ceil(cases.length / PAGE))
  const logPages = Math.max(1, Math.ceil(logRows.length / PAGE))
  const current = SEGMENTS.find((s) => s.key === segment)!

  return (
    <div className="page">
      <PageHeader
        title="What was each AI worker"
        accent="authorized to do?"
        subtitle="Every case keeps the decision stored at execution time, the permission events it relied on, and a replay check. The log is append-only: new events are added, existing ones never change."
      />

      {featured && (
        <div className="featured">
          <div>
            <strong>Featured incident: {featured.title}</strong>
            <p>
              {nameOf(featured.workerId)} was authorized to do this, its authority changed while the work was in progress, and then it was attempted. Replay what it was allowed to do at each step, who was accountable, and how that differs from today.
            </p>
          </div>
          <Button variant="primary" onClick={() => go('governance', featured.id)}>
            Replay the incident
          </Button>
        </div>
      )}

      <Card flush>
        <div className="stats" aria-label={`Last ${WINDOW_DAYS} days`}>
          <span>
            <strong>{stats.attempts}</strong> authorization decisions
          </span>
          <span>
            <strong>{stats.allowed}</strong> allowed
          </span>
          <span>
            <strong>{stats.denied}</strong> denied
          </span>
          <span>
            <strong>{stats.permissionChanges}</strong> permission changes
          </span>
          <span>
            <strong>
              {stats.replayVerified} of {stats.attempts}
            </strong>{' '}
            replay-verified
          </span>
          <span className="muted">last {WINDOW_DAYS} days</span>
        </div>

        <div style={{ padding: '0 var(--s-5)' }}>
          <Tabs
            label="Governance views"
            value={view}
            onChange={(v) => {
              setView(v)
              setQ('')
            }}
            tabs={[
              { key: 'cases', label: 'Cases', count: state.operations.length },
              { key: 'log', label: 'Event log', count: state.events.length },
            ]}
          />
        </div>

        {view === 'cases' && (
          <div className="segments">
            <div className="seg" role="group" aria-label="Case outcome">
              {SEGMENTS.map((s) => (
                <button
                  key={s.key}
                  aria-pressed={segment === s.key}
                  onClick={() => {
                    setSegment(s.key)
                    setCasePage(0)
                  }}
                >
                  {s.label} <span className="num muted">{counts[s.key]}</span>
                </button>
              ))}
            </div>
            <p className="segments__help">{current.help}</p>
          </div>
        )}

        <div className="filters">
          <div className="search">
            <Icon name="search" size={16} />
            <input
              className="input"
              type="search"
              aria-label={view === 'cases' ? 'Search cases' : 'Search events'}
              placeholder={view === 'cases' ? 'Search case or worker' : 'Search actor, worker or case'}
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setCasePage(0)
                setLogPage(0)
              }}
            />
          </div>
          {view === 'log' && (
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
            {view === 'cases' ? `${cases.length} cases` : `${logRows.length} events`}
          </span>
        </div>

        {view === 'cases' ? (
          <>
            <DataTable
              label="Cases"
              rows={cases.slice(casePage * PAGE, casePage * PAGE + PAGE)}
              columns={caseColumns}
              rowKey={(r) => r.op.id}
              onRowClick={(r) => go('governance', r.op.id)}
              empty={
                <div className="empty">
                  <span className="empty__title">No cases here</span>
                  <p>Nothing matches this outcome and search. Try another outcome, or run an in-progress operation to create a stored decision.</p>
                </div>
              }
            />
            <Pager page={casePage} pages={casePages} total={cases.length} onPage={setCasePage} />
          </>
        ) : (
          <>
            <DataTable
              label="Event log"
              rows={logRows.slice(logPage * PAGE, logPage * PAGE + PAGE)}
              columns={logColumns}
              rowKey={(e) => e.id}
              selectedKey={drawerEvent?.id}
              onRowClick={(e) => go('governance', e.id)}
              empty="No events match."
            />
            <Pager page={logPage} pages={logPages} total={logRows.length} onPage={setLogPage} />
          </>
        )}
      </Card>

      <p className="policy-note">
        Prototype policy: authorization must be valid at the moment a consequential action executes, and revocation before execution prevents the action. This is a browser
        simulation and does not provide production-grade security.
      </p>

      {drawerEvent && <EventDrawer event={drawerEvent} onClose={() => go('governance')} />}
    </div>
  )
}
