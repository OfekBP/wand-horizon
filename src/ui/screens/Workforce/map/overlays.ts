import type { Finding, Reach } from '../../../../domain/findings'
import { boundsOf, type MapLayout, type Rect } from '../../../../domain/orgLayout'
import { blockedOperations, caseRows, classifyAiWorkers, openConflicts } from '../../../../domain/selectors'
import type { AppState } from '../../../../domain/types'
import type { Overlay } from './WorkforceMap'
import type { Lens, Selection } from './selection'

const COST_RISE = 0.25

/**
 * What each lens draws, derived from live state. The map never holds its own copy of an issue:
 * when the underlying data changes (a conflict resolved, a decision moved) the drawing changes with it.
 */
export function buildOverlay(state: AppState, lens: Lens, selection: Selection | null, finding: Finding | undefined): Overlay {
  const overlay: Overlay = { emphasis: null, arcs: [], links: [], flags: new Set(), costRise: new Set(), sizes: null }
  const classes = classifyAiWorkers(state)
  const by = new Map(state.workers.map((w) => [w.id, w]))

  if (lens === 'value') {
    const ai = state.workers.filter((w) => w.kind === 'ai')
    const max = Math.max(1, ...ai.map((w) => w.monthlyCost))
    overlay.sizes = new Map(ai.map((w) => [w.id, 3 + (w.monthlyCost / max) * 3.4]))
    overlay.emphasis = new Set(ai.filter((w) => classes.get(w.id) !== 'verified').map((w) => w.id))
    for (const w of ai) {
      if (classes.get(w.id) !== 'verified' && w.status === 'active' && w.priorMonthlyCost && w.monthlyCost / w.priorMonthlyCost - 1 >= COST_RISE) overlay.costRise.add(w.id)
    }
  } else if (lens === 'conflicts') {
    const open = openConflicts(state)
    overlay.arcs = open.map((c) => ({ a: c.workerAId, b: c.workerBId, kind: c.kind }))
    overlay.emphasis = new Set(open.flatMap((c) => [c.workerAId, c.workerBId]))
  } else if (lens === 'blocked') {
    const blocked = blockedOperations(state)
    overlay.links = blocked.map((o) => ({ from: o.workerId, to: o.decisionOwnerId, critical: by.get(o.decisionOwnerId)?.availability?.status === 'out_of_office' }))
    overlay.flags = new Set(blocked.map((o) => o.workerId))
    overlay.emphasis = new Set(blocked.map((o) => o.workerId))
  } else if (lens === 'authority') {
    const rows = caseRows(state).filter((r) => (r.op.status === 'in_progress' || r.op.status === 'awaiting_approval') && (r.changedDuringCase.length > 0 || r.liveDecision?.decision === 'denied'))
    overlay.flags = new Set(rows.map((r) => r.op.workerId))
    overlay.emphasis = new Set(rows.map((r) => r.op.workerId))
  } else if (lens === 'missions' && selection?.kind === 'mission') {
    overlay.emphasis = new Set(state.workers.filter((w) => w.missionId === selection.id).map((w) => w.id))
  }

  // A focused selection narrows what stays at full strength, whatever the lens.
  if (finding) overlay.emphasis = new Set(finding.reach.workerIds)
  else if (selection?.kind === 'team') overlay.emphasis = new Set(state.workers.filter((w) => w.teamId === selection.id && w.kind === 'ai').map((w) => w.id))
  else if (selection?.kind === 'worker' && by.get(selection.id)?.kind === 'human') overlay.emphasis = new Set(state.workers.filter((w) => w.ownerId === selection.id).map((w) => w.id))
  return overlay
}

const MIN_W = 300
const MIN_H = 230

function atLeast(r: Rect): Rect {
  const w = Math.max(r.w, MIN_W)
  const h = Math.max(r.h, MIN_H)
  return { x: r.x - (w - r.w) / 2, y: r.y - (h - r.h) / 2, w, h }
}

/** Where the camera should go for a selection. null means the whole organization. */
export function focusFor(layout: MapLayout, state: AppState, selection: Selection | null, reach: Reach | undefined): Rect | null {
  if (reach) {
    const b = boundsOf(layout, [...reach.workerIds, ...reach.humanIds], 26)
    return b ? atLeast(b) : null
  }
  if (!selection) return null
  if (selection.kind === 'team') return layout.regions.get(selection.id) ?? null
  if (selection.kind === 'mission') {
    const b = boundsOf(layout, state.workers.filter((w) => w.missionId === selection.id).map((w) => w.id), 30)
    return b ? atLeast(b) : null
  }
  if (selection.kind === 'worker') {
    const w = state.workers.find((x) => x.id === selection.id)
    const podOwner = w?.kind === 'ai' ? w.ownerId : w?.id
    const pod = podOwner ? layout.pods.get(podOwner) : undefined
    if (pod) return atLeast({ x: pod.x - 6, y: pod.y - 6, w: pod.w + 12, h: pod.h + 12 })
    const b = boundsOf(layout, [selection.id], 60)
    return b ? atLeast(b) : null
  }
  return null
}
