import { useMemo } from 'react'
import { findings as deriveFindings } from '../../../domain/findings'
import { authorityAtRisk, criticalIssues, overviewMetrics, queueCounts, scenarioProgress, teamPerformance, type TeamRow } from '../../../domain/selectors'
import { useNav } from '../../../state/nav'
import { useApp } from '../../../state/store'
import { age, dateTime, money, pct } from '../../format'
import { Badge, SeverityBadge } from '../../primitives/Badge'
import { Icon } from '../../primitives/Icon'
import { Card, PageHeader } from '../../primitives/Layout'
import { DataTable, type Column } from '../../primitives/Table'
import './overview.css'

export function Overview() {
  const { state } = useApp()
  const { go } = useNav()
  const m = useMemo(() => overviewMetrics(state), [state])
  const teams = useMemo(() => teamPerformance(state), [state])
  const issues = useMemo(() => criticalIssues(state, 3), [state])
  const counts = useMemo(() => queueCounts(state), [state])
  const risk = useMemo(() => authorityAtRisk(state), [state])
  const scenarios = useMemo(() => scenarioProgress(state), [state])
  const found = useMemo(() => deriveFindings(state), [state])
  // Where a problem has a finding, the map is the best place to understand it; otherwise the queue.
  const openIssue = (i: { id: string; kind: string }) => {
    const f = found.find((x) => x.id === `${i.kind === 'blocked' ? 'blocked' : 'conflict'}:${i.id}`)
    if (f) go('workforce', f.id)
    else go('queue', i.id)
  }

  const maxValue = Math.max(1, ...teams.flatMap((t) => [t.verifiedValue, t.estimatedValue]))
  const wireWorker = state.workers.find((w) => w.name === 'Payments-Disburse-003')
  const scenarioLink: Record<string, () => void> = {
    reassign: () => go('workforce', 'blocked:op-a1'),
    resolve: () => go('workforce', 'conflict:c-001'),
    permission: () => go('workforce', wireWorker?.id),
    history: () => go('governance', 'op-c1'),
  }
  const scenarioHint: Record<string, string> = {
    reassign: 'Workforce map · the blocked settlement batch',
    resolve: 'Workforce map · two missions fighting over the liquidity buffer',
    permission: 'Workforce · Payments-Disburse-003, then run its wire in Governance',
    history: 'Governance · change the permission again and watch the decision hold',
  }

  const teamColumns: Column<TeamRow>[] = [
    { key: 'team', header: 'Team', sort: (a, b) => a.team.name.localeCompare(b.team.name), render: (r) => <span className="strong">{r.team.name}</span> },
    { key: 'people', header: 'People', align: 'right', sort: (a, b) => a.humans - b.humans, render: (r) => r.humans },
    { key: 'ai', header: 'AI workers', align: 'right', sort: (a, b) => a.aiWorkers - b.aiWorkers, render: (r) => r.aiWorkers },
    {
      key: 'verified',
      header: 'Verified value',
      sort: (a, b) => a.verifiedValue - b.verifiedValue,
      render: (r) => (
        <div className="mini">
          <span className="mini__track">
            <span className="mini__bar mini__bar--verified" style={{ width: `${(r.verifiedValue / maxValue) * 100}%` }} />
          </span>
          <span className="mini__val strong">{money(r.verifiedValue)}</span>
        </div>
      ),
    },
    {
      key: 'estimated',
      header: 'Estimated value',
      sort: (a, b) => a.estimatedValue - b.estimatedValue,
      render: (r) => (
        <div className="mini">
          <span className="mini__track">
            <span className="mini__bar mini__bar--estimated" style={{ width: `${(r.estimatedValue / maxValue) * 100}%` }} />
          </span>
          <span className="mini__val mini__val--muted">{money(r.estimatedValue)}</span>
        </div>
      ),
    },
    { key: 'cost', header: 'AI operating cost', align: 'right', sort: (a, b) => a.aiCost - b.aiCost, render: (r) => money(r.aiCost) },
    {
      key: 'coverage',
      header: 'Workers with verified value',
      align: 'right',
      sort: (a, b) => a.coverage - b.coverage,
      render: (r) => pct(r.coverage),
    },
    { key: 'issues', header: 'Open issues', align: 'right', sort: (a, b) => a.openIssues - b.openIssues, render: (r) => (r.openIssues > 0 ? <span className="strong">{r.openIssues}</span> : <span className="muted">0</span>) },
  ]

  return (
    <div className="page">
      <PageHeader
        title="How the workforce is"
        accent="running"
        subtitle={`${m.humans} people and ${m.aiWorkers} AI workers, trailing 30 days, as of ${dateTime(state.clock)}. Decide what is blocked here, then check in Governance what each AI worker was authorized to do.`}
      />

      <div className="lanes">
        <Card
          title="Needs a decision"
          subtitle={`${counts.blocked} blocked operations (${counts.criticalBlocked} critical) and ${counts.conflicts} open conflicts. Most severe and longest waiting first.`}
          actions={<Badge tone="accent">Operate</Badge>}
          flush
        >
          {issues.length === 0 ? (
            <div className="empty">
              <span className="empty__title">All clear</span>
              <p>Nothing is blocked or in conflict. New items appear here the moment an operation needs a human decision.</p>
            </div>
          ) : (
            <ul className="rows">
              {issues.map((i) => (
                <li key={i.id}>
                  <button className="row-btn" onClick={() => openIssue(i)} aria-label={`Investigate ${i.title}`}>
                    <SeverityBadge severity={i.severity} />
                    <span style={{ minWidth: 0 }}>
                      <div className="row-btn__title">{i.title}</div>
                      <div className="row-btn__detail">{i.detail}</div>
                    </span>
                    <span className="row-btn__age">
                      <strong className="num">{age(i.since, state.clock)}</strong>
                      {i.kind === 'blocked' ? 'blocked' : 'open'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="card__foot">
            <span>{counts.concerns} performance concerns are also open.</span>
            <span style={{ display: 'inline-flex', gap: 'var(--s-4)' }}>
              <button className="link" onClick={() => go('workforce')}>
                See {found.length} findings on the map
              </button>
              <button className="link" onClick={() => go('queue')}>
                Open the Work Queue
              </button>
            </span>
          </div>
        </Card>

        <Card
          title={`Authority at risk · ${risk.length}`}
          subtitle="In-progress operations that would be denied if they ran right now. Derived from today's permissions, not a recorded decision."
          actions={<Badge tone="accent">Assure</Badge>}
          flush
          className="card--night"
        >
          {risk.length === 0 ? (
            <div className="empty">
              <span className="empty__title">Nothing in flight would be denied</span>
              <p>Revoke a permission or lower a limit while an operation is in progress and it appears here, with the evidence behind it.</p>
              <button className="link" onClick={() => go('workforce', wireWorker?.id)}>
                Try it on Payments-Disburse-003
              </button>
            </div>
          ) : (
            <ul className="rows">
              {risk.slice(0, 3).map((r) => (
                <li key={r.op.id}>
                  <button className="row-btn row-btn--risk" onClick={() => go('governance', r.op.id)} aria-label={`Open the evidence for ${r.op.title}`}>
                    <span style={{ minWidth: 0 }}>
                      <div className="row-btn__title">{r.op.title}</div>
                      <div className="row-btn__detail">
                        <span className="risk-note">{r.authorityNote}</span> · {money(r.op.amount)}
                      </div>
                      {r.changedDuringCase.length > 0 && (
                        <div className="seq row-btn__seq">permission changed at #{r.changedDuringCase[r.changedDuringCase.length - 1].seq}</div>
                      )}
                    </span>
                    <span className="row-btn__go">
                      Evidence <Icon name="arrow" size={12} style={{ verticalAlign: -1 }} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="card__foot card__foot--stack">
            <span>Nothing here has been decided yet. A decision is stored when the operation runs.</span>
            <button className="link" onClick={() => go('governance')}>
              Open Governance
            </button>
          </div>
        </Card>
      </div>

      <div className="lanes">
        <Card title="Value" subtitle="Trailing 30 days. Three kinds of value are reported separately and are never added together." flush>
          <dl className="ledger">
            <div className="ledger__row">
              <dt className="ledger__label">
                <span className="sw sw--verified" />
                Verified
              </dt>
              <dd style={{ margin: 0 }}>
                <div className="ledger__amount ledger__amount--verified num">{money(m.verifiedValue)}</div>
                <div className="ledger__note">Outcomes confirmed in a system of record, such as a reconciled ledger or a settled payment.</div>
              </dd>
            </div>
            <div className="ledger__row">
              <dt className="ledger__label">
                <span className="sw sw--estimated" />
                Estimated
              </dt>
              <dd style={{ margin: 0 }}>
                <div className="ledger__amount num">{money(m.estimatedValue)}</div>
                <div className="ledger__note">Model-based and unconfirmed. Shown for context and never counted as verified.</div>
              </dd>
            </div>
            <div className="ledger__row">
              <dt className="ledger__label">
                <span className="sw sw--unmeasured" />
                Unmeasured
              </dt>
              <dd style={{ margin: 0 }}>
                <div className="ledger__amount num">{m.unmeasuredWorkers} AI workers</div>
                <div className="ledger__note">No value records of any kind. No dollar figure is assigned to them.</div>
              </dd>
            </div>
          </dl>
          <div className="cover">
            <div className="cover__sentence">
              <strong>{pct(m.coverage, 1)}</strong> of active AI workers have verified value ({m.verifiedWorkers} of {m.activeAi}).
            </div>
            <div className="cover__bar" role="img" aria-label={`${m.verifiedWorkers} verified, ${m.estimatedOnlyWorkers} estimated only, ${m.unmeasuredWorkers} unmeasured`}>
              <span className="cover__seg" style={{ flex: m.verifiedWorkers, background: 'var(--value-verified)' }} />
              <span className="cover__seg" style={{ flex: m.estimatedOnlyWorkers, background: 'repeating-linear-gradient(135deg, var(--value-estimated-fg) 0 2px, var(--value-estimated-bg) 2px 4px)' }} />
              <span className="cover__seg cover__seg--unmeasured" style={{ flex: m.unmeasuredWorkers }} />
            </div>
            <div className="cover__legend">
              <span>
                <span className="sw sw--verified" />
                Verified <span className="num">{m.verifiedWorkers}</span>
              </span>
              <span>
                <span className="sw sw--estimated" />
                Estimated only <span className="num">{m.estimatedOnlyWorkers}</span>
              </span>
              <span>
                <span className="sw sw--unmeasured" />
                Unmeasured <span className="num">{m.unmeasuredWorkers}</span>
              </span>
            </div>
          </div>
        </Card>

        <div style={{ display: 'grid', gap: 'var(--s-5)' }}>
          <Card title="Operating cost" subtitle="Monthly and modeled. Reported separately, never blended, never compared with value." flush>
            <dl className="cost">
              <div className="cost__row">
                <div>
                  <div className="cost__label">AI operating cost</div>
                  <div className="cost__note">Inference and tooling for {m.aiWorkers} AI workers</div>
                </div>
                <div className="cost__amount">{money(m.aiCost)}</div>
              </div>
              <div className="cost__row">
                <div>
                  <div className="cost__label">Human labor cost</div>
                  <div className="cost__note">Synthetic loaded cost of {m.humans} people</div>
                </div>
                <div className="cost__amount">{money(m.humanCost)}</div>
              </div>
            </dl>
          </Card>

          <Card title="Try the scenarios" subtitle="Each one ticks off from real events in the audit log." flush>
            <ul className="scenarios">
              {scenarios.map((s) => (
                <li key={s.key} className={`scenario${s.done ? ' scenario--done' : ''}`}>
                  <span className="scenario__mark" aria-hidden="true">
                    {s.done && <Icon name="check" size={13} />}
                  </span>
                  <span>
                    <div className="scenario__title">
                      {s.title}
                      {s.done && <span className="sr-only"> (done)</span>}
                    </div>
                    <div className="scenario__hint">{scenarioHint[s.key]}</div>
                  </span>
                  {!s.done && (
                    <button className="link" onClick={scenarioLink[s.key]}>
                      Start
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Card title="Teams" subtitle="Value, cost and open issues by team. Click a column to sort. Bars share one scale." flush>
        <DataTable label="Teams" rows={teams} columns={teamColumns} rowKey={(r) => r.team.id} />
      </Card>

      <details className="card">
        <summary>
          How these numbers are defined
          <span className="chev">
            <Icon name="chevron" size={16} />
          </span>
        </summary>
        <dl className="defs">
          <div>
            <dt>Verified value</dt>
            <dd>Sum of value records whose outcome was confirmed in a system of record, over the trailing 30 days. Attributed to AI workers only.</dd>
          </div>
          <div>
            <dt>Estimated value</dt>
            <dd>Sum of model-based value records (for example time saved or loss avoided). Always reported separately and never added to verified value.</dd>
          </div>
          <div>
            <dt>Unmeasured AI workers</dt>
            <dd>Active AI workers with no value record of either kind. A worker with only estimated value is "estimated only", not unmeasured.</dd>
          </div>
          <div>
            <dt>Workers with verified value</dt>
            <dd>
              Active AI workers with at least one verified value record divided by all active AI workers ({m.verifiedWorkers} of {m.activeAi}). A count of workers, not weighted by
              dollars.
            </dd>
          </div>
          <div>
            <dt>AI operating cost and human labor cost</dt>
            <dd>Modeled monthly inference and tooling cost for AI workers, and synthetic loaded monthly cost for people. Reported separately. No return, savings or profit is calculated.</dd>
          </div>
          <div>
            <dt>Authority at risk</dt>
            <dd>
              In-progress operations that today's permissions would deny if they ran now. It is a live reading, never a stored decision. A decision is recorded only when an operation
              runs, and that stored decision is never recomputed.
            </dd>
          </div>
          <div>
            <dt>Blocked operation</dt>
            <dd>An operation awaiting a human approval decision. Ranked by severity, then by how long it has waited.</dd>
          </div>
        </dl>
      </details>
    </div>
  )
}
