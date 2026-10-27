import { useEffect, useMemo, useState } from 'react'
import { describeEvent } from '../../../../domain/audit'
import { FINDING_LABEL, findings as deriveFindings, missionSummary } from '../../../../domain/findings'
import { layoutMap } from '../../../../domain/orgLayout'
import { classifyAiWorkers } from '../../../../domain/selectors'
import { useNav } from '../../../../state/nav'
import { useApp } from '../../../../state/store'
import { money } from '../../../format'
import { SeverityBadge } from '../../../primitives/Badge'
import { Button } from '../../../primitives/Button'
import type { Resolution } from './FindingActions'
import { SituationPanel } from './SituationPanel'
import { WorkforceMap } from './WorkforceMap'
import { buildOverlay, focusFor } from './overlays'
import { LENSES, lensForFinding, parseSelection, type Lens, type Selection } from './selection'
import './map.css'

const PANEL_PX = 372

/** Below this width the situation panel stacks under the map instead of docking over it. */
function useNarrow(query = '(max-width: 1100px)') {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches)
  useEffect(() => {
    const mq = window.matchMedia?.(query)
    if (!mq) return
    const on = () => setNarrow(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return narrow
}

export function MapView() {
  const { state, index } = useApp()
  const { selectedId, go } = useNav()
  const [manual, setManual] = useState<{ lens: Lens; forId: string | null } | null>(null)
  const [resolution, setResolution] = useState<Resolution | null>(null)
  const narrow = useNarrow()

  const layout = useMemo(() => layoutMap(state.workers, state.teams), [state.workers, state.teams])
  const all = useMemo(() => deriveFindings(state), [state])
  const classes = useMemo(() => classifyAiWorkers(state), [state])
  const teamNames = useMemo(() => new Map(state.teams.map((t) => [t.id, t.name])), [state.teams])

  // An operation id resolves to the finding about it, or to the worker doing it.
  const raw = useMemo(() => parseSelection(selectedId), [selectedId])
  const finding = useMemo(
    () => (raw?.kind === 'finding' ? all.find((f) => f.id === raw.id) : raw?.kind === 'op' ? all.find((f) => f.reach.opIds.includes(raw.id)) : undefined),
    [raw, all],
  )
  const selection = useMemo<Selection | null>(() => {
    if (raw?.kind !== 'op') return raw
    if (finding) return { kind: 'finding', id: finding.id }
    return { kind: 'worker', id: state.operations.find((o) => o.id === raw.id)?.workerId ?? '' }
  }, [raw, finding, state.operations])

  const lens: Lens = manual && manual.forId === selectedId ? manual.lens : finding ? lensForFinding(finding.kind) : 'ownership'
  const overlay = useMemo(() => buildOverlay(state, lens, selection, finding), [state, lens, selection, finding])
  // After a finding is resolved it disappears from the data, but the camera stays on the cluster it described.
  const focusReach = finding?.reach ?? (resolution && selection?.kind === 'finding' && resolution.findingId === selection.id ? resolution.reach : undefined)
  const focus = useMemo(() => focusFor(layout, state, selection, focusReach), [layout, state, selection, focusReach])
  const highlight = useMemo(
    () =>
      finding
        ? { ids: new Set([...finding.reach.workerIds, ...finding.reach.humanIds]), tone: (finding.severity === 'critical' || finding.severity === 'high' ? 'critical' : 'warn') as 'critical' | 'warn' }
        : null,
    [finding],
  )
  const panelOpen = !!selection && !(selection.kind === 'worker' && !selection.id)
  const showMissions = lens === 'missions' && !selection
  const help = LENSES.find((l) => l.key === lens)!.help

  const select = (id: string | null) => (id ? go('workforce', id) : go('workforce'))
  const close = () => {
    setResolution(null)
    go('workforce')
  }

  const since = Date.parse(state.seedClock)
  const log = state.events.filter((e) => Date.parse(e.at) > since && ['OwnerReassigned', 'ConflictResolved', 'WorkersPaused', 'PermissionChanged'].includes(e.type)).slice(-6).reverse()
  const nameOf = (id: string) => index.workerById.get(id)?.name ?? id

  const missionsAside = (
            <aside className="situation" aria-label="Missions">
              <div className="situation__bar">
                <span className="section-label">Missions</span>
              </div>
              <div className="situation__body">
                <p className="small muted">A mission puts AI workers from different teams behind one objective and one accountable person. Select one to see where its workers are.</p>
                <ul className="missions">
                  {state.missions.map((m) => {
                    const s = missionSummary(state, m)
                    return (
                      <li key={m.id}>
                        <button className="mission" onClick={() => select(m.id)}>
                          <span className="strong">{m.name}</span>
                          <span className="xs muted">
                            {index.workerById.get(m.ownerId)?.name} · {s.members} AI workers · {money(s.cost)} per month
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </aside>
  )

  return (
    <div className="mapview">
      <aside className="mapview__side" aria-label="What the map found">
        <div className="mapview__sidehead">
          <h2>What the map found</h2>
          <span className="num muted xs">{all.length} open</span>
        </div>
        {all.length === 0 ? (
          <div className="empty">
            <span className="empty__title">Nothing needs you</span>
            <p>Every blocked decision has an available owner, conflicts are closed, and unproven spend is paused. New findings appear here as the data changes.</p>
          </div>
        ) : (
          <ul className="findings">
            {all.map((f) => (
              <li key={f.id}>
                <button className={`finding${selection?.kind === 'finding' && selection.id === f.id ? ' is-selected' : ''}`} onClick={() => select(f.id)} aria-label={`${FINDING_LABEL[f.kind]}: ${f.title}`}>
                  <span className="finding__top">
                    <SeverityBadge severity={f.severity} />
                    <span className="finding__kind">{FINDING_LABEL[f.kind]}</span>
                  </span>
                  <span className="finding__title">{f.title}</span>
                  <span className="finding__reach xs muted">
                    {f.reach.workerIds.length} {f.reach.workerIds.length === 1 ? 'worker' : 'workers'} · {f.reach.humanIds.length} {f.reach.humanIds.length === 1 ? 'person' : 'people'}
                    {f.reach.missionIds.length > 0 && ` · ${f.reach.missionIds.length} ${f.reach.missionIds.length === 1 ? 'mission' : 'missions'}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mapview__sidehead mapview__sidehead--log">
          <h2>Decision log</h2>
          <span className="num muted xs">this session</span>
        </div>
        {log.length === 0 ? (
          <p className="xs muted mapview__logempty">Decisions you take here are written to the audit log and appear below.</p>
        ) : (
          <ul className="log">
            {log.map((e) => {
              const v = describeEvent(e, nameOf)
              return (
                <li key={e.id}>
                  <button className="log__item" onClick={() => go('governance', e.id)}>
                    <span className="seq">#{e.seq}</span>
                    <span>
                      <span className="strong small">{v.title}</span>
                      <span className="xs muted log__line">{v.lines[0]}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </aside>

      <section className="mapview__stage" aria-label="Workforce map">
        <div className="mapview__toolbar">
          <div className="seg" role="group" aria-label="Map lens">
            {LENSES.map((l) => (
              <button key={l.key} aria-pressed={lens === l.key} onClick={() => setManual({ lens: l.key, forId: selectedId })}>
                {l.label}
              </button>
            ))}
          </div>
          {selection && (
            <Button size="sm" variant="ghost" onClick={close}>
              Show the whole organization
            </Button>
          )}
        </div>
        <p className="mapview__help xs muted">{help}</p>

        <div className={`mapview__canvas${panelOpen || showMissions ? ' has-panel' : ''}`}>
          <WorkforceMap
            layout={layout}
            workers={index.workerById}
            classes={classes}
            teamNames={teamNames}
            overlay={overlay}
            highlight={highlight}
            selectedId={selection?.kind === 'worker' ? selection.id : null}
            focus={focus}
            coveredPx={!narrow && (panelOpen || showMissions) ? PANEL_PX : 0}
            onSelectWorker={(id) => select(id)}
            onSelectTeam={(id) => select(id)}
          />
          {!narrow && panelOpen && selection && <SituationPanel selection={selection} finding={finding} resolution={resolution} onResolved={setResolution} onClose={close} />}
          {!narrow && showMissions && missionsAside}
        </div>

        {narrow && panelOpen && selection && <SituationPanel selection={selection} finding={finding} resolution={resolution} onResolved={setResolution} onClose={close} />}
        {narrow && showMissions && missionsAside}

        <div className="legend" aria-label="Legend">
          <span>
            <i className="legend__person" /> Person
          </span>
          <span>
            <i className="legend__dot legend__dot--verified" /> AI worker, verified value
          </span>
          <span>
            <i className="legend__dot legend__dot--estimated" /> estimated only
          </span>
          <span>
            <i className="legend__dot legend__dot--unmeasured" /> unmeasured
          </span>
          <span>
            <i className="legend__away" /> out of office
          </span>
          <span>Lines: reporting</span>
        </div>
      </section>
    </div>
  )
}
