import { useMemo, useState } from 'react'
import { FINDING_LABEL, findings, missionSummary, type ChainLink, type Finding } from '../../../../domain/findings'
import { buildRoi, missionReturn, teamReturn } from '../../../../domain/roi'
import { teamPerformance } from '../../../../domain/selectors'
import { useNav } from '../../../../state/navContext'
import { useApp } from '../../../../state/appContext'
import { RoiBadge } from '../../../primitives/RoiBadge'
import { money, pct } from '../../../format'
import { Badge, SeverityBadge } from '../../../primitives/Badge'
import { Button } from '../../../primitives/Button'
import { Icon } from '../../../primitives/Icon'
import { PermissionDialog } from '../PermissionDialog'
import { WorkerProfile } from '../WorkerProfile'
import { FindingActions, type Resolution } from './FindingActions'
import type { Selection } from './selection'

interface Props {
  selection: Selection
  finding: Finding | undefined
  resolution: Resolution | null
  onResolved: (r: Resolution) => void
  onClose: () => void
}

function Chain({ links }: { links: ChainLink[] }) {
  const { go } = useNav()
  const open = (l: ChainLink) => {
    if (!l.ref) return
    if (l.ref.kind === 'op') go('queue', l.ref.id)
    else if (l.ref.kind === 'conflict') go('queue', l.ref.id)
    else go('workforce', l.ref.id)
  }
  return (
    <ol className="chain">
      {links.map((l, i) => (
        <li key={i} className="chain__item">
          <span className="chain__n" aria-hidden="true">
            {i + 1}
          </span>
          <div>
            <div className="chain__label">{l.label}</div>
            <div className="chain__detail">{l.detail}</div>
            {l.ref && (
              <button className="link xs" onClick={() => open(l)}>
                {l.ref.kind === 'op' || l.ref.kind === 'conflict' ? 'Open in Work Queue' : 'Show on the map'}
              </button>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

function FindingView({ finding, resolution, onResolved }: { finding: Finding; resolution: Resolution | null; onResolved: (r: Resolution) => void }) {
  const { go } = useNav()
  const opId = finding.reach.opIds[0]
  return (
    <>
      <div className="situation__kicker">
        <SeverityBadge severity={finding.severity} />
        <Badge>{FINDING_LABEL[finding.kind]}</Badge>
      </div>
      <h2 className="situation__title">{finding.title}</h2>
      <section aria-label="Why it matters">
        <div className="section-label">Why it matters</div>
        <p className="situation__consequence">{finding.consequence}</p>
      </section>
      <section aria-label="How we got here">
        <div className="section-label">How we got here</div>
        <Chain links={finding.chain} />
      </section>
      <section aria-label="Decide">
        <div className="section-label">Decide</div>
        <FindingActions finding={finding} onResolved={onResolved} />
      </section>
      {(opId || resolution) && (
        <div className="situation__links">
          {opId && (
            <button className="link xs" onClick={() => go('queue', opId)}>
              Open in Work Queue
            </button>
          )}
          {opId && (
            <button className="link xs" onClick={() => go('governance', opId)}>
              Open the evidence
            </button>
          )}
        </div>
      )}
    </>
  )
}

function ResolvedView({ resolution, onClose }: { resolution: Resolution; onClose: () => void }) {
  const { go } = useNav()
  return (
    <div className="resolved" role="status">
      <div className="resolved__mark" aria-hidden="true">
        <Icon name="check" size={16} />
      </div>
      <h2 className="situation__title">{resolution.title}</h2>
      <p className="small">{resolution.body}</p>
      <p className="xs muted">
        Recorded in the audit log as event <span className="seq">#{resolution.seq}</span>.
      </p>
      <div className="decide__row">
        <Button onClick={() => go('governance', resolution.govId)}>View the audit event</Button>
        <Button variant="primary" onClick={onClose}>
          Back to the findings
        </Button>
      </div>
    </div>
  )
}

function TeamView({ teamId }: { teamId: string }) {
  const { state, index } = useApp()
  const { go } = useNav()
  const row = useMemo(() => teamPerformance(state).find((r) => r.team.id === teamId)!, [state, teamId])
  const lead = state.workers.find((w) => w.kind === 'human' && w.teamId === teamId && (w.ownerId === null || index.workerById.get(w.ownerId ?? '')?.ownerId === null))
  const touching = findings(state).filter((f) => f.reach.teamIds.includes(teamId))
  const missions = state.missions.filter((m) => state.workers.some((w) => w.missionId === m.id && w.teamId === teamId))
  const ret = useMemo(() => teamReturn(state, buildRoi(state), teamId), [state, teamId])
  return (
    <>
      <div className="situation__kicker">
        <Badge tone="accent">Team</Badge>
      </div>
      <h2 className="situation__title">{row.team.name}</h2>
      <dl className="facts">
        <div>
          <dt>Head</dt>
          <dd>{lead?.name}</dd>
        </div>
        <div>
          <dt>People · AI workers</dt>
          <dd className="num">
            {row.humans} · {row.aiWorkers}
          </dd>
        </div>
        <div>
          <dt>Verified value</dt>
          <dd className="num">{money(row.verifiedValue)}</dd>
        </div>
        <div>
          <dt>Estimated value</dt>
          <dd className="num muted">{money(row.estimatedValue)}</dd>
        </div>
        <div>
          <dt>AI operating cost (active)</dt>
          <dd className="num">{money(row.aiCost)}</dd>
        </div>
        <div>
          <dt>Workers with verified value</dt>
          <dd className="num">{pct(row.coverage)}</dd>
        </div>
        <div>
          <dt>Return on cost (verified)</dt>
          <dd>
            <RoiBadge status={ret.status} multiple={ret.multiple} />
          </dd>
        </div>
      </dl>
      <section aria-label="Findings in this team">
        <div className="section-label">Findings touching this team ({touching.length})</div>
        {touching.length === 0 ? (
          <p className="small muted">Nothing needs attention here.</p>
        ) : (
          <ul className="mini-list">
            {touching.map((f) => (
              <li key={f.id}>
                <button className="link" onClick={() => go('workforce', f.id)}>
                  {f.title}
                </button>
                <SeverityBadge severity={f.severity} />
              </li>
            ))}
          </ul>
        )}
      </section>
      {missions.length > 0 && (
        <section aria-label="Missions">
          <div className="section-label">Missions with workers here</div>
          <ul className="mini-list">
            {missions.map((m) => (
              <li key={m.id}>
                <button className="link" onClick={() => go('workforce', m.id)}>
                  {m.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function MissionView({ missionId }: { missionId: string }) {
  const { state, index } = useApp()
  const { go } = useNav()
  const mission = state.missions.find((m) => m.id === missionId)!
  const s = useMemo(() => missionSummary(state, mission), [state, mission])
  const owner = index.workerById.get(mission.ownerId)
  const teams = [...new Set(state.workers.filter((w) => w.missionId === missionId).map((w) => index.teamById.get(w.teamId)?.name))]
  const touching = findings(state).filter((f) => f.reach.missionIds.includes(missionId))
  const ret = useMemo(() => missionReturn(state, buildRoi(state), missionId), [state, missionId])
  return (
    <>
      <div className="situation__kicker">
        <Badge tone="accent">Mission</Badge>
      </div>
      <h2 className="situation__title">{mission.name}</h2>
      <p className="small">{mission.objective}</p>
      <dl className="facts">
        <div>
          <dt>Accountable</dt>
          <dd>
            <button className="link" onClick={() => owner && go('workforce', owner.id)}>
              {owner?.name}
            </button>
          </dd>
        </div>
        <div>
          <dt>AI workers</dt>
          <dd className="num">
            {s.active} active of {s.members}
          </dd>
        </div>
        <div>
          <dt>Value evidence</dt>
          <dd className="num">
            {s.verified} verified · {s.estimatedOnly} estimated · {s.unmeasured} unmeasured
          </dd>
        </div>
        <div>
          <dt>Modeled cost per month</dt>
          <dd className="num">{money(s.cost)}</dd>
        </div>
        <div>
          <dt>Previous 30 days (simulated)</dt>
          <dd className="num">{money(s.priorCost)}</dd>
        </div>
        <div>
          <dt>Return on cost (verified)</dt>
          <dd>
            <RoiBadge status={ret.status} multiple={ret.multiple} />
          </dd>
        </div>
        <div>
          <dt>Teams</dt>
          <dd>{teams.join(', ')}</dd>
        </div>
      </dl>
      <section aria-label="Findings on this mission">
        <div className="section-label">Findings on this mission ({touching.length})</div>
        {touching.length === 0 ? (
          <p className="small muted">No open findings.</p>
        ) : (
          <ul className="mini-list">
            {touching.map((f) => (
              <li key={f.id}>
                <button className="link" onClick={() => go('workforce', f.id)}>
                  {f.title}
                </button>
                <SeverityBadge severity={f.severity} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function WorkerView({ workerId }: { workerId: string }) {
  const { state, index } = useApp()
  const [editing, setEditing] = useState(false)
  const worker = index.workerById.get(workerId)
  if (!worker) return <p className="small muted">This worker no longer exists.</p>
  const team = index.teamById.get(worker.teamId)
  void state
  return (
    <>
      <div className="situation__kicker">
        <Badge tone={worker.kind === 'ai' ? 'accent' : 'neutral'}>{worker.kind === 'ai' ? 'AI worker' : 'Person'}</Badge>
        <span className="xs muted">{team?.name}</span>
      </div>
      <h2 className="situation__title">{worker.name}</h2>
      <p className="small muted">{worker.role}</p>
      <WorkerProfile worker={worker} onChangePermissions={worker.kind === 'ai' ? () => setEditing(true) : undefined} />
      {editing && <PermissionDialog worker={worker} onClose={() => setEditing(false)} />}
    </>
  )
}

export function SituationPanel({ selection, finding, resolution, onResolved, onClose }: Props) {
  const showResolved = resolution && selection.kind === 'finding' && resolution.findingId === selection.id
  return (
    <aside className="situation" aria-label="Situation">
      <div className="situation__bar">
        <span className="section-label">Situation</span>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close the situation panel">
          <Icon name="close" size={16} />
        </Button>
      </div>
      <div className="situation__body">
        {showResolved ? (
          <ResolvedView resolution={resolution} onClose={onClose} />
        ) : selection.kind === 'finding' ? (
          finding ? (
            <FindingView finding={finding} resolution={resolution} onResolved={onResolved} />
          ) : (
            <p className="small muted">This finding no longer applies. It was resolved, or the data it was based on changed.</p>
          )
        ) : selection.kind === 'worker' ? (
          <WorkerView workerId={selection.id} />
        ) : selection.kind === 'team' ? (
          <TeamView teamId={selection.id} />
        ) : selection.kind === 'mission' ? (
          <MissionView missionId={selection.id} />
        ) : null}
      </div>
    </aside>
  )
}
