import { useMemo, type ReactNode } from 'react'
import { criticalIssues, overviewMetrics, queueCounts, teamPerformance, type Issue, type TeamRow } from '../../../domain/selectors'
import { useNav } from '../../../state/nav'
import { useApp } from '../../../state/store'
import { age, dateTime, money, moneyCompact, pct } from '../../format'
import { Button } from '../../primitives/Button'
import { SeverityBadge } from '../../primitives/Badge'
import { Icon } from '../../primitives/Icon'
import { Card, PageHeader } from '../../primitives/Layout'
import { DataTable, type Column } from '../../primitives/Table'
import './overview.css'

function Stat({ label, value, sub, swatch, lead }: { label: string; value: ReactNode; sub: string; swatch?: 'verified' | 'estimated' | 'unmeasured'; lead?: boolean }) {
  return (
    <div className={`stat${lead ? ' stat--lead' : ''}`}>
      <div className="stat__label">
        {swatch && <span className={`sw sw--${swatch}`} />}
        {label}
      </div>
      <div className="stat__value">{value}</div>
      <div className="stat__sub">{sub}</div>
    </div>
  )
}

function TeamValueBars({ rows }: { rows: TeamRow[] }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.verifiedValue, r.estimatedValue]))
  const sorted = [...rows].sort((a, b) => b.verifiedValue - a.verifiedValue)
  return (
    <div className="bars" role="list" aria-label="Value by team">
      {sorted.map((r) => (
        <div className="bars__row" role="listitem" key={r.team.id}>
          <div className="bars__name" title={r.team.name}>
            {r.team.name}
          </div>
          <div className="bars__pair">
            <div className="bars__line">
              <div className="bars__track">
                <div className="bar bar--verified" style={{ width: `${(r.verifiedValue / max) * 100}%` }} />
              </div>
              <div className="bars__val bars__val--verified num">{moneyCompact(r.verifiedValue)}</div>
            </div>
            <div className="bars__line">
              <div className="bars__track">
                <div className="bar bar--estimated" style={{ width: `${(r.estimatedValue / max) * 100}%` }} />
              </div>
              <div className="bars__val num">{moneyCompact(r.estimatedValue)}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function Overview() {
  const { state } = useApp()
  const { go } = useNav()
  const m = useMemo(() => overviewMetrics(state), [state])
  const teams = useMemo(() => teamPerformance(state), [state])
  const issues = useMemo(() => criticalIssues(state, 6), [state])
  const counts = useMemo(() => queueCounts(state), [state])

  const teamColumns: Column<TeamRow>[] = [
    { key: 'team', header: 'Team', sort: (a, b) => a.team.name.localeCompare(b.team.name), render: (r) => <span className="strong">{r.team.name}</span> },
    { key: 'humans', header: 'People', align: 'right', sort: (a, b) => a.humans - b.humans, render: (r) => r.humans },
    { key: 'ai', header: 'AI workers', align: 'right', sort: (a, b) => a.aiWorkers - b.aiWorkers, render: (r) => r.aiWorkers },
    { key: 'verified', header: 'Verified value', align: 'right', sort: (a, b) => a.verifiedValue - b.verifiedValue, render: (r) => money(r.verifiedValue) },
    { key: 'estimated', header: 'Estimated value', align: 'right', sort: (a, b) => a.estimatedValue - b.estimatedValue, render: (r) => <span className="muted">{money(r.estimatedValue)}</span> },
    { key: 'cost', header: 'AI operating cost', align: 'right', sort: (a, b) => a.aiCost - b.aiCost, render: (r) => money(r.aiCost) },
    {
      key: 'coverage',
      header: 'Verified coverage',
      align: 'right',
      sort: (a, b) => a.coverage - b.coverage,
      render: (r) => (
        <span className="cov-cell">
          <span className="cov-cell__bar" aria-hidden="true">
            <span style={{ width: pct(r.coverage) }} />
          </span>
          {pct(r.coverage)}
        </span>
      ),
    },
    { key: 'issues', header: 'Open issues', align: 'right', sort: (a, b) => a.openIssues - b.openIssues, render: (r) => (r.openIssues > 0 ? <span className="strong">{r.openIssues}</span> : <span className="muted">0</span>) },
  ]

  const open = (i: Issue) => go('queue', i.id)

  return (
    <div className="page">
      <PageHeader
        title="Overview"
        subtitle={`${m.humans} people and ${m.aiWorkers} AI workers · trailing 30 days · as of ${dateTime(state.clock)}`}
      />

      <div className="ov-grid">
        <div className="ov-col">
          <Card
            title="Business value"
            subtitle="Three kinds of value, reported separately. They are never added together."
            flush
          >
            <div className="biz__stats">
              <Stat lead swatch="verified" label="Verified value" value={moneyCompact(m.verifiedValue)} sub="Outcomes confirmed in a system of record, such as a reconciled ledger or settled payment." />
              <Stat swatch="estimated" label="Estimated value" value={moneyCompact(m.estimatedValue)} sub="Model-based and unconfirmed. Shown for context, not counted as verified." />
              <Stat swatch="unmeasured" label="Unmeasured AI workers" value={m.unmeasuredWorkers} sub="No value records of any kind. No dollar figure is assigned to them." />
            </div>
            <div className="biz__chart">
              <div className="biz__chart-head">
                <h3>Value by team</h3>
                <div className="legend">
                  <span>
                    <span className="sw sw--verified" />
                    Verified
                  </span>
                  <span>
                    <span className="sw sw--estimated" />
                    Estimated
                  </span>
                </div>
              </div>
              <TeamValueBars rows={teams} />
            </div>
          </Card>
        </div>

        <div className="ov-col">
          <Card title="Operating cost" subtitle="Monthly, modeled. Not blended and not compared with value.">
            <div className="split-stats">
              <Stat label="AI operating cost" value={moneyCompact(m.aiCost)} sub={`Inference and tooling for ${m.aiWorkers} AI workers.`} />
              <Stat label="Human labor cost" value={moneyCompact(m.humanCost)} sub={`Synthetic loaded cost of ${m.humans} people.`} />
            </div>
          </Card>

          <Card title="Verified coverage" subtitle="How much of the AI workforce has confirmed value.">
            <div className="cover">
              <Stat lead label="Verified coverage" value={pct(m.coverage, 1)} sub={`${m.verifiedWorkers} of ${m.activeAi} active AI workers have at least one verified value record.`} />
              <div className="cover__bar" role="img" aria-label={`${m.verifiedWorkers} verified, ${m.estimatedOnlyWorkers} estimated only, ${m.unmeasuredWorkers} unmeasured`}>
                <span className="cover__seg" style={{ flex: m.verifiedWorkers, background: 'var(--value-verified)' }} />
                <span className="cover__seg" style={{ flex: m.estimatedOnlyWorkers, background: 'repeating-linear-gradient(135deg, var(--value-estimated-fg) 0 2px, var(--value-estimated-bg) 2px 4px)' }} />
                <span className="cover__seg cover__seg--unmeasured" style={{ flex: m.unmeasuredWorkers }} />
              </div>
              <div className="cover__legend">
                <div>
                  <span>
                    <span className="sw sw--verified" />
                    Verified
                  </span>
                  <span className="num">{m.verifiedWorkers}</span>
                </div>
                <div>
                  <span>
                    <span className="sw sw--estimated" />
                    Estimated only
                  </span>
                  <span className="num">{m.estimatedOnlyWorkers}</span>
                </div>
                <div>
                  <span>
                    <span className="sw sw--unmeasured" />
                    Unmeasured
                  </span>
                  <span className="num">{m.unmeasuredWorkers}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Card
        title="Needs attention"
        subtitle={`${counts.blocked} blocked operations (${counts.criticalBlocked} critical) · ${counts.conflicts} open conflicts · ${counts.concerns} performance concerns`}
        actions={
          <Button size="sm" onClick={() => go('queue')}>
            Open Work Queue <Icon name="arrow" size={14} />
          </Button>
        }
        flush
      >
        {issues.length === 0 ? (
          <div className="empty">Nothing needs attention.</div>
        ) : (
          <ul className="issues">
            {issues.map((i) => (
              <li key={i.id} className="issue" tabIndex={0} onClick={() => open(i)} onKeyDown={(e) => e.key === 'Enter' && open(i)}>
                <SeverityBadge severity={i.severity} />
                <div style={{ minWidth: 0 }}>
                  <div className="issue__title">{i.title}</div>
                  <div className="issue__detail">{i.detail}</div>
                </div>
                <div className="issue__age">
                  <strong className="num">{age(i.since, state.clock)}</strong>
                  {i.kind === 'blocked' ? 'blocked' : 'open'}
                </div>
                <Button size="sm" variant="primary" tabIndex={-1} aria-label={`Investigate ${i.title}`}>
                  Investigate
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Team performance" subtitle="Value, cost and open issues by team. Click a column to sort." flush>
        <DataTable label="Team performance" rows={teams} columns={teamColumns} rowKey={(r) => r.team.id} />
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
            <dd>Active AI workers with no value record of either kind. A worker with only estimated value is “estimated only”, not unmeasured.</dd>
          </div>
          <div>
            <dt>Verified coverage</dt>
            <dd>
              Active AI workers with at least one verified value record ÷ all active AI workers ({m.verifiedWorkers} ÷ {m.activeAi}). A count of workers, not
              weighted by dollars.
            </dd>
          </div>
          <div>
            <dt>AI operating cost / Human labor cost</dt>
            <dd>Modeled monthly inference and tooling cost for AI workers, and synthetic loaded monthly cost for people. Reported separately. No return, savings or profit is calculated.</dd>
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
