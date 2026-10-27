import { useMemo, useState } from 'react'
import { findings as deriveFindings } from '../../../domain/findings'
import { buildRoi, companyReturn, fmtMultiple, teamReturn } from '../../../domain/roi'
import { authorityAtRisk, criticalIssues, overviewMetrics, queueCounts, teamPerformance, type TeamRow } from '../../../domain/selectors'
import { useNav } from '../../../state/navContext'
import { useApp } from '../../../state/appContext'
import { age, dateTime, money, pct } from '../../format'
import { SeverityBadge } from '../../primitives/Badge'
import { Button } from '../../primitives/Button'
import { Icon } from '../../primitives/Icon'
import { RoiBadge, RoiLegend } from '../../primitives/RoiBadge'
import { Card, PageHeader } from '../../primitives/Layout'
import { FEATURED_INCIDENT } from '../Governance/Governance'
import { TERMS } from '../../terms'
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
  const found = useMemo(() => deriveFindings(state), [state])
  const roi = useMemo(() => buildRoi(state), [state])
  const company = useMemo(() => companyReturn(state, roi), [state, roi])
  // Where a problem has a finding, the map is the best place to understand it; otherwise the queue.
  const openIssue = (i: { id: string; kind: string }) => {
    const f = found.find((x) => x.id === `${i.kind === 'blocked' ? 'blocked' : 'conflict'}:${i.id}`)
    if (f) go('workforce', f.id)
    else go('queue', i.id)
  }

  const maxValue = Math.max(1, ...teams.flatMap((t) => [t.verifiedValue, t.estimatedValue]))
  const blockedTop = found.find((f) => f.kind === 'blocked-decision')
  const spend = found.filter((f) => f.kind === 'cost-without-proof')
  const dismissKey = 'wh-firstrun-dismissed'
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(dismissKey) === '1'
    } catch {
      return false
    }
  })
  const dismiss = () => {
    setDismissed(true)
    try {
      window.localStorage.setItem(dismissKey, '1')
    } catch {
      // storage can be unavailable; the strip simply comes back next visit
    }
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
      key: 'return',
      header: 'Return',
      sort: (a, b) => (teamReturn(state, roi, a.team.id).multiple ?? -1) - (teamReturn(state, roi, b.team.id).multiple ?? -1),
      render: (r) => {
        const g = teamReturn(state, roi, r.team.id)
        return <RoiBadge status={g.status} multiple={g.multiple} />
      },
    },
    { key: 'cost', header: 'AI operating cost', align: 'right', sort: (a, b) => a.aiCost - b.aiCost, render: (r) => money(r.aiCost) },
    { key: 'issues', header: 'Open issues', align: 'right', sort: (a, b) => a.openIssues - b.openIssues, render: (r) => (r.openIssues > 0 ? <span className="strong">{r.openIssues}</span> : <span className="muted">0</span>) },
  ]

  return (
    <div className="page">
      <PageHeader
        title="How the workforce is"
        accent="running"
        subtitle={`Wand Horizon shows how a company of ${m.humans} people and ${m.aiWorkers} AI workers is running, what is stuck, and what each AI worker was allowed to do. Start with one of the three questions below. Data is synthetic, trailing 30 days, as of ${dateTime(state.clock)}.`}
      />

      {!dismissed && (
        <div className="firstrun" role="note">
          <span>
            New here? <a href="#/demo">Watch the 90-second demo</a>, or follow the three questions below.
          </span>
          <button className="link" onClick={dismiss}>
            Dismiss
          </button>
        </div>
      )}

      <div className="asks">
        <section className="ask" aria-labelledby="ask-stuck">
          <h2 id="ask-stuck">{TERMS.askStuck}</h2>
          <p className="ask__stat">
            <strong className="num">{counts.blocked}</strong> operations wait on a person ({counts.criticalBlocked} critical), and {counts.conflicts} conflicts between workers are open.
          </p>
          <p className="ask__text">{blockedTop ? `${blockedTop.title}. ${blockedTop.consequence}` : 'Nothing is blocked by an unavailable person right now.'}</p>
          <Button variant="primary" onClick={() => go('workforce', blockedTop?.id)}>
            {blockedTop ? TERMS.investigateUrgent : 'Open the org map'}
          </Button>
        </section>

        <section className="ask" aria-labelledby="ask-spend">
          <h2 id="ask-spend">{TERMS.askSpend}</h2>
          <p className="ask__stat">
            <strong className="num">{fmtMultiple(company.multiple)}</strong> verified return on AI spend
            <span className="ask__sub">{money(company.verified)} confirmed value against {money(company.cost)} a month. Synthetic data.</span>
          </p>
          <div className="ask__counts" aria-label="Workers by return">
            {(['green', 'amber', 'red', 'grey'] as const).map((c) => (
              <span key={c} className="ask__count">
                <RoiBadge status={c} />
                <strong className="num">{company.counts[c]}</strong>
              </span>
            ))}
          </div>
          <p className="ask__text">
            <strong className="num">{money(company.unprovenCost)}</strong> a month is spent on workers with no verified return.
            {spend[0] ? ` ${spend[0].title}.` : ''}
          </p>
          <div className="ask__actions">
            <Button variant="primary" onClick={() => go('workforce', 'registry:attention')}>
              {TERMS.whoToReview}
            </Button>
            {spend[0] && <Button onClick={() => go('workforce', spend[0].id)}>{TERMS.reviewSpend}</Button>}
          </div>
        </section>

        <section className="ask" aria-labelledby="ask-allowed">
          <h2 id="ask-allowed">{TERMS.askAllowed}</h2>
          <p className="ask__stat">What matters is the permission an AI worker had at the moment it acted, even if that permission changed after the work began.</p>
          <p className="ask__label">{`Permission changed after work started · ${risk.length}`}</p>
          {risk.length === 0 ? (
            <p className="ask__text">No in-flight operation would be denied right now.</p>
          ) : (
            <ul className="rows ask__rows">
              {risk.slice(0, 2).map((r) => (
                <li key={r.op.id}>
                  <button className="row-btn row-btn--risk" onClick={() => go('governance', r.op.id)} aria-label={`Open the evidence for ${r.op.title}`}>
                    <span style={{ minWidth: 0 }}>
                      <div className="row-btn__title">{r.op.title}</div>
                      <div className="row-btn__detail">
                        <span className="risk-note">{r.authorityNote}</span> · {money(r.op.amount)}
                      </div>
                    </span>
                    <span className="row-btn__go">
                      Evidence <Icon name="arrow" size={12} style={{ verticalAlign: -1 }} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button variant="primary" onClick={() => go('governance', FEATURED_INCIDENT)}>
            {TERMS.replayIncident}
          </Button>
        </section>
      </div>

      <details className="more">
        <summary>
          More detail: everything that needs a decision, value, cost and teams
          <span className="chev">
            <Icon name="chevron" size={16} />
          </span>
        </summary>
        <div className="more__body">
        <Card
          title="Needs a decision"
          subtitle={`${counts.blocked} blocked operations (${counts.criticalBlocked} critical) and ${counts.conflicts} open conflicts. Most severe and longest waiting first.`}
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
          {spend.length > 0 && (
            <>
              <div className="rows__label">Spend without proof (modeled cost, simulated comparison)</div>
              <ul className="rows">
                {spend.map((f) => (
                  <li key={f.id}>
                    <button className="row-btn" onClick={() => go('workforce', f.id)} aria-label={`Investigate ${f.title}`}>
                      <SeverityBadge severity={f.severity} />
                      <span style={{ minWidth: 0 }}>
                        <div className="row-btn__title">{f.title}</div>
                        <div className="row-btn__detail">{f.consequence}</div>
                      </span>
                      <span className="row-btn__age">
                        <strong className="num">{f.reach.workerIds.length}</strong>
                        workers
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
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
          <Card title="Operating cost" subtitle="Monthly and modeled. Reported separately and never blended. Return on cost, which compares cost with verified value only, is shown on Start here and in the Registry." flush>
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
        </div>
      </div>

      <RoiLegend />

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
            <dd>Modeled monthly inference and tooling cost for AI workers, and synthetic loaded monthly cost for people. Reported separately. No savings or profit is calculated.</dd>
          </div>
          <div>
            <dt>Return on cost</dt>
            <dd>
              Verified value divided by modeled monthly cost, trailing 30 days, for active AI workers. Estimated value is shown beside it and never counted. Green at 3× or more, amber from 1× to 3× or when only
              estimated value exists, red under 1× or when there is no verified value and cost is rising 25% or more, grey when there is no value data. A person has no value records, so a person's figure is
              the return of the AI workers they are accountable for. The thresholds are a policy setting and the data is synthetic.
            </dd>
          </div>
          <div>
            <dt>Permission changed after work started</dt>
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
      </details>
    </div>
  )
}
