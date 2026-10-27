import { useEffect, useMemo, useState } from 'react'
import { describeEvent, narrateEvent, scopeStateText } from '../../../domain/audit'
import { scopeStateAsOf } from '../../../domain/authorize'
import { SCOPES } from '../../../domain/reducer'
import type { AuditEvent, Operation, ScopeState } from '../../../domain/types'
import { useApp } from '../../../state/store'
import { dateTime } from '../../format'
import { Badge } from '../../primitives/Badge'
import { Button } from '../../primitives/Button'
import { Card } from '../../primitives/Layout'
import './replay.css'

type Lane = 'worker' | 'people' | 'record'

const LANES: Array<{ key: Lane; label: (worker: string) => string; help: string }> = [
  { key: 'worker', label: (w) => w, help: 'The AI worker' },
  { key: 'people', label: () => 'People', help: 'Who changed what' },
  { key: 'record', label: () => 'Authorization record', help: 'The stored decision' },
]

const laneOf = (e: AuditEvent): Lane =>
  e.type === 'AuthorizationEvaluated' ? 'record' : e.type === 'PermissionChanged' || e.type === 'OwnerReassigned' ? 'people' : 'worker'

const same = (a: ScopeState, b: ScopeState) => a.active === b.active && a.limit === b.limit

interface Props {
  op: Operation
  /** Events for the case plus every permission change for the worker and scope, in seq order. */
  timeline: AuditEvent[]
  selectedSeq: number
  onPick: (seq: number) => void
}

/**
 * The incident as it unfolded, in order of record (not to time scale). Moving the playhead rebuilds
 * the permission state as of that point from the stored events and sets it beside today's, so
 * historical authorization and current permissions are never confused.
 */
export function IncidentReplay({ op, timeline, selectedSeq, onPick }: Props) {
  const { state, index } = useApp()
  const [playing, setPlaying] = useState(false)

  const n = timeline.length
  const idx = Math.max(0, timeline.findIndex((e) => e.seq === selectedSeq))
  const current = timeline[idx]
  const nameOf = (id: string) => index.workerById.get(id)?.name ?? id
  const worker = index.workerById.get(op.workerId)
  const scopeLabel = SCOPES[op.requiredScope] ?? op.requiredScope
  const x = (i: number) => (n <= 1 ? 50 : 6 + (i / (n - 1)) * 88)

  const nowSeq = state.nextSeq - 1
  const live = useMemo(() => scopeStateAsOf(state.events, op.workerId, op.requiredScope, nowSeq), [state.events, op.workerId, op.requiredScope, nowSeq])
  const stateAfter = useMemo(() => timeline.map((e) => scopeStateAsOf(state.events, op.workerId, op.requiredScope, e.seq).state), [timeline, state.events, op.workerId, op.requiredScope])

  const isEval = current?.type === 'AuthorizationEvaluated'
  const cutoff = current ? (isEval ? current.cutoffSeq : current.seq) : nowSeq
  const then = useMemo(() => scopeStateAsOf(state.events, op.workerId, op.requiredScope, cutoff), [state.events, op.workerId, op.requiredScope, cutoff])
  const differs = !same(then.state, live.state)

  // Accountability at the playhead, from the record only.
  const decisionOwnerAt = useMemo(() => {
    let owner = op.decisionOwnerId
    const started = state.events.find((e) => e.type === 'OperationStarted' && e.operationId === op.id)
    if (started?.type === 'OperationStarted') owner = started.ownerId
    for (const e of state.events) if (e.type === 'OwnerReassigned' && e.operationId === op.id && e.seq <= (current?.seq ?? 0)) owner = e.toOwnerId
    return owner
  }, [state.events, op.id, op.decisionOwnerId, current?.seq])
  const lastChange = then.evidence[then.evidence.length - 1]

  useEffect(() => {
    if (!playing) return
    if (idx >= n - 1) {
      setPlaying(false)
      return
    }
    const t = window.setTimeout(() => onPick(timeline[idx + 1].seq), 1400)
    return () => window.clearTimeout(t)
  }, [playing, idx, n, timeline, onPick])

  if (n < 2 || !current) return null
  const story = narrateEvent(current, { nameOf, op, scopeLabel })
  const tone = describeEvent(current, nameOf).tone

  return (
    <Card
      title="Incident replay"
      subtitle="The incident in order of record. Move the playhead to rebuild what the worker was authorized to do at that point, and compare it with today."
      actions={
        <div className="rp__controls">
          <Button
            size="sm"
            onClick={() => {
              if (!playing && idx >= n - 1) onPick(timeline[0].seq)
              setPlaying((p) => !p)
            }}
            aria-pressed={playing}
          >
            {playing ? 'Pause' : idx >= n - 1 ? 'Replay' : 'Play'}
          </Button>
          <Button size="sm" variant="ghost" disabled={idx === 0} onClick={() => (setPlaying(false), onPick(timeline[Math.max(0, idx - 1)].seq))}>
            Previous
          </Button>
          <Button size="sm" variant="ghost" disabled={idx >= n - 1} onClick={() => (setPlaying(false), onPick(timeline[Math.min(n - 1, idx + 1)].seq))}>
            Next
          </Button>
        </div>
      }
      flush
    >
      <div className="rp">
        <div className="rp__lanes">
          <div className="rp__bands" aria-hidden="true">
            {timeline.slice(0, -1).map((e, i) =>
              same(stateAfter[i], live.state) ? null : <span key={e.id} className="rp__band" style={{ left: `${x(i)}%`, width: `${x(i + 1) - x(i)}%` }} />,
            )}
          </div>
          <div className="rp__headwrap" aria-hidden="true">
            <span className="rp__playhead" style={{ left: `${x(idx)}%` }} />
          </div>
          {LANES.map((lane) => (
            <div key={lane.key} className="rp__lane">
              <div className="rp__label">
                <span className="strong small">{lane.label(worker?.name ?? '')}</span>
                <span className="xs muted">{lane.help}</span>
              </div>
              <div className="rp__track">
                {timeline.map((e, i) => {
                  if (laneOf(e) !== lane.key) return null
                  const v = describeEvent(e, nameOf)
                  return (
                    <button
                      key={e.id}
                      className={`rp__mark rp__mark--${v.tone}${i === idx ? ' is-on' : ''}`}
                      style={{ left: `${x(i)}%` }}
                      onClick={() => (setPlaying(false), onPick(e.seq))}
                      aria-label={`Event #${e.seq}: ${v.title}`}
                      aria-current={i === idx}
                      title={`#${e.seq} · ${v.title}`}
                    />
                  )
                })}
              </div>
            </div>
          ))}
          <div className="rp__axis" aria-hidden="true">
            {timeline.map((e, i) => (
              <span key={e.id} className={`rp__tick${i === idx ? ' is-on' : ''}`} style={{ left: `${x(i)}%` }}>
                <span className="seq">#{e.seq}</span>
                <span className="xs muted">{dateTime(e.at).replace(' UTC', '').replace(',', '')}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="rp__scrub">
          <input
            type="range"
            min={0}
            max={n - 1}
            value={idx}
            onChange={(e) => (setPlaying(false), onPick(timeline[Number(e.target.value)].seq))}
            aria-label="Replay position"
            aria-valuetext={`Event #${current.seq}: ${describeEvent(current, nameOf).title}`}
          />
          <span className="xs muted">
            Event {idx + 1} of {n}. Hatched bands mark where the authority at that point differs from today's.
          </span>
        </div>

        <p className={`rp__story rp__story--${tone}`} aria-live="polite">
          <span className="seq">#{current.seq}</span> {story}
        </p>

        <div className="rp__compare" role="group" aria-label="Authorized then and permitted now">
          <div className="rp__col">
            <div className="section-label">Authorized then</div>
            <div className="rp__state">{scopeStateText(then.state, then.evidence.length > 0)}</div>
            <div className="xs muted">
              {isEval ? 'What the stored decision relied on' : 'Rebuilt from the permission events'} up to <span className="seq">#{cutoff}</span>.
            </div>
          </div>
          <div className={`rp__col rp__col--now${differs ? ' is-differs' : ''}`}>
            <div className="section-label">Permitted now</div>
            <div className="rp__state">{scopeStateText(live.state, live.evidence.length > 0)}</div>
            <div className="xs muted">
              Today, up to <span className="seq">#{nowSeq}</span>. {differs ? <strong>Differs from then.</strong> : 'Same as then.'}
            </div>
          </div>
        </div>

        <dl className="rp__who">
          <div>
            <dt>Recorded by</dt>
            <dd>{current.actor}</dd>
          </div>
          <div>
            <dt>Worker owner</dt>
            <dd>{nameOf(worker?.ownerId ?? '')}</dd>
          </div>
          <div>
            <dt>Decision owner</dt>
            <dd>{nameOf(decisionOwnerAt)}</dd>
          </div>
          <div>
            <dt>Authority last set by</dt>
            <dd>
              {lastChange ? (
                <>
                  {lastChange.actor} <span className="seq">#{lastChange.seq}</span>
                  <div className="xs muted">{lastChange.reason}</div>
                </>
              ) : (
                <span className="muted">Nobody yet</span>
              )}
            </dd>
          </div>
        </dl>
        {differs && (
          <div className="rp__note">
            <Badge tone="accent">Historical, not current</Badge> The stored decision stands as recorded. Today's permission is shown only for comparison.
          </div>
        )}
      </div>
    </Card>
  )
}
