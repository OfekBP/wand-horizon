import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { type MapLayout, type Rect } from '../../../../domain/orgLayout'
import type { ValueClass } from '../../../../domain/selectors'
import type { Worker } from '../../../../domain/types'

export interface Overlay {
  /** Workers drawn at full strength; everything else recedes. null means nothing recedes. */
  emphasis: Set<string> | null
  arcs: Array<{ a: string; b: string; kind: 'duplicate' | 'contradiction' }>
  /** Decision lines: from the worker whose operation is blocked to the person who must decide. */
  links: Array<{ from: string; to: string; critical: boolean }>
  flags: Set<string>
  /** Amber ring: modeled cost rise with no verified value. */
  costRise: Set<string>
  /** Dot radius override, by worker id (value lens). */
  sizes: Map<string, number> | null
}

interface Props {
  layout: MapLayout
  workers: Map<string, Worker>
  classes: Map<string, ValueClass>
  teamNames: Map<string, string>
  overlay: Overlay
  /** The finding's reach: pulsing rings. */
  highlight: { ids: Set<string>; tone: 'critical' | 'warn' } | null
  selectedId: string | null
  focus: Rect | null
  /** Pixels at the right edge covered by the situation panel. */
  coveredPx: number
  onSelectWorker: (id: string) => void
  onSelectTeam: (id: string) => void
}

interface Box {
  x: number
  y: number
  w: number
  h: number
}

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Fit `target` into the visible part of a container of `size`, leaving `coveredPx` free at the right. */
function fit(target: Rect, size: { w: number; h: number }, coveredPx: number): Box {
  const visibleW = Math.max(120, size.w - coveredPx)
  // Never zoom so far that labels balloon: a focus is a neighbourhood, not a single dot.
  const s = Math.min(visibleW / target.w, size.h / target.h, 2.2)
  const w = size.w / s
  const h = size.h / s
  const cx = target.x + target.w / 2
  const cy = target.y + target.h / 2
  return { x: cx - visibleW / 2 / s, y: cy - h / 2, w, h }
}

export function WorkforceMap({ layout, workers, classes, teamNames, overlay, highlight, selectedId, focus, coveredPx, onSelectWorker, onSelectTeam }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 900, h: 560 })
  const whole: Rect = useMemo(() => ({ x: 0, y: 0, w: layout.width, h: layout.height }), [layout])

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const measure = () => setSize({ w: Math.max(320, el.clientWidth), h: Math.max(320, el.clientHeight) })
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [])

  const target = useMemo(() => fit(focus ?? whole, size, coveredPx), [focus, whole, size, coveredPx])
  const [anim, setVb] = useState<Box>(target)
  const reduced = prefersReducedMotion()
  const vb = reduced ? target : anim
  const vbRef = useRef(anim)
  useEffect(() => {
    vbRef.current = anim
  }, [anim])

  // Camera: ease to the target, or jump when the user prefers reduced motion.
  useEffect(() => {
    if (reduced) return
    const from = vbRef.current
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 480)
      const e = 1 - Math.pow(1 - t, 3)
      setVb({ x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, w: from.w + (target.w - from.w) * e, h: from.h + (target.h - from.h) * e })
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, reduced])

  const scale = size.w / vb.w
  const labelPods = scale > 1.45
  const dim = (id: string) => (overlay.emphasis && !overlay.emphasis.has(id) ? ' is-dim' : '')

  const activate = (id: string) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelectWorker(id)
    }
  }

  const humans = [...layout.nodes.values()].filter((n) => n.kind === 'human')
  const dots = [...layout.nodes.values()].filter((n) => n.kind === 'ai')
  const pos = (id: string) => layout.nodes.get(id)!

  return (
    <div className="map" ref={wrap}>
      <svg
        className="map__svg"
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        role="group"
        aria-label="Workforce map: 50 people and 500 AI workers, grouped by team and by the person accountable for each AI worker"
      >
        <defs>
          <pattern id="map-hatch" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="3" height="3" fill="var(--value-estimated-bg)" />
            <line x1="0" y1="0" x2="0" y2="3" stroke="var(--value-estimated-fg)" strokeWidth="1.3" />
          </pattern>
        </defs>

        {/* team regions */}
        {[...layout.regions.entries()].map(([teamId, r]) => {
          const people = humans.filter((h) => h.teamId === teamId).length
          const ai = dots.filter((d) => d.teamId === teamId).length
          return (
            <g key={teamId} className="map__region">
              <rect className="map__region-box" x={r.x} y={r.y} width={r.w} height={r.h} rx="10" onClick={() => onSelectTeam(teamId)} />
              <text className="map__team" x={r.x + 12} y={r.y + 20} onClick={() => onSelectTeam(teamId)}>
                {teamNames.get(teamId)}
              </text>
              <text className="map__team-sub" x={r.x + r.w - 12} y={r.y + 20} textAnchor="end">
                {people} people · {ai} AI
              </text>
            </g>
          )
        })}

        {/* reporting lines: the organizational hierarchy */}
        <g className="map__edges" aria-hidden="true">
          {layout.edges
            .filter((e) => e.level === 'top')
            .map((e) => {
              const pts = e.path ?? []
              return <path key={`${e.from}-${e.to}`} d={pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ')} />
            })}
        </g>

        {/* lens overlays that sit under the nodes */}
        <g aria-hidden="true">
          {overlay.arcs.map((a) => {
            const p = pos(a.a)
            const q = pos(a.b)
            const mx = (p.x + q.x) / 2
            const my = (p.y + q.y) / 2
            const dx = q.x - p.x
            const dy = q.y - p.y
            const bow = Math.min(90, Math.hypot(dx, dy) * 0.22)
            const d = `M ${p.x} ${p.y} Q ${mx - (dy / Math.hypot(dx, dy || 1)) * bow} ${my + (dx / Math.hypot(dx || 1, dy)) * bow} ${q.x} ${q.y}`
            return <path key={`${a.a}-${a.b}`} className={`map__arc map__arc--${a.kind}`} d={d} />
          })}
          {overlay.links.map((l) => (
            <line key={`${l.from}-${l.to}`} className={`map__link${l.critical ? ' is-critical' : ''}`} x1={pos(l.from).x} y1={pos(l.from).y} x2={pos(l.to).x} y2={pos(l.to).y} />
          ))}
        </g>

        {/* people */}
        {humans.map((n) => {
          const w = workers.get(n.id)!
          const away = w.availability?.status === 'out_of_office'
          const isExec = n.id === layout.execId
          const lead = !isExec && !layout.pods.has(n.id)
          const selected = selectedId === n.id
          return (
            <g
              key={n.id}
              className={`map__human${away ? ' is-away' : ''}${selected ? ' is-selected' : ''}${isExec ? ' is-exec' : ''}`}
              tabIndex={0}
              role="button"
              aria-label={`${w.name}, ${w.role}${away ? ', out of office' : ''}`}
              onClick={() => onSelectWorker(n.id)}
              onKeyDown={activate(n.id)}
            >
              <title>
                {w.name} · {w.role}
                {away ? ' · out of office' : ''}
              </title>
              {highlight?.ids.has(n.id) && <circle className={`map__pulse map__pulse--${highlight.tone}`} cx={n.x} cy={n.y} r={n.r + 5} />}
              {away && <circle className="map__away" cx={n.x} cy={n.y} r={n.r + 3.2} />}
              <circle className="map__person" cx={n.x} cy={n.y} r={n.r} />
              {away && <path className="map__slash" d={`M ${n.x - n.r * 0.7} ${n.y + n.r * 0.7} L ${n.x + n.r * 0.7} ${n.y - n.r * 0.7}`} />}
              {(isExec || lead || selected || labelPods || highlight?.ids.has(n.id)) && (
                <text className={`map__name${lead ? ' is-lead' : ''}`} x={n.x} y={isExec ? n.y - n.r - 5 : lead ? n.y + n.r + 11 : n.y + n.r + 9} textAnchor="middle">
                  {w.name}
                  {away ? ' (away)' : ''}
                </text>
              )}
            </g>
          )
        })}

        {/* AI workers */}
        {dots.map((n) => {
          const w = workers.get(n.id)!
          const cls = classes.get(n.id)
          const lit = highlight?.ids.has(n.id)
          const r = overlay.sizes?.get(n.id) ?? n.r
          return (
            <g
              key={n.id}
              className={`map__ai${dim(n.id)}${w.status === 'paused' ? ' is-paused' : ''}${selectedId === n.id ? ' is-selected' : ''}`}
              tabIndex={lit ? 0 : -1}
              role="button"
              aria-label={`${w.name}, AI worker, ${cls === 'verified' ? 'verified value' : cls === 'estimatedOnly' ? 'estimated value only' : 'unmeasured'}${w.status === 'paused' ? ', paused' : ''}`}
              onClick={() => onSelectWorker(n.id)}
              onKeyDown={activate(n.id)}
            >
              <title>
                {w.name} · {w.role} · ${w.monthlyCost.toLocaleString('en-US')} per month (modeled)
              </title>
              {lit && <circle className={`map__pulse map__pulse--${highlight!.tone}`} cx={n.x} cy={n.y} r={r + 3.4} />}
              {overlay.flags.has(n.id) && <circle className="map__flag" cx={n.x} cy={n.y} r={r + 2.2} />}
              {overlay.costRise.has(n.id) && <circle className="map__rise" cx={n.x} cy={n.y} r={r + 2.2} />}
              <circle className={`map__dot map__dot--${cls ?? 'unmeasured'}`} cx={n.x} cy={n.y} r={r} />
            </g>
          )
        })}
      </svg>
    </div>
  )
}
