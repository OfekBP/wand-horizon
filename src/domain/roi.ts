import { COST_RISE } from './findings'
import { classifyAiWorkers, type ValueClass } from './selectors'
import type { AppState, Worker } from './types'

/*
 * Return on cost: what a manager needs to decide who to keep, review or pause.
 *
 * The number is VERIFIED value divided by MODELED monthly cost, over the trailing 30 days, for active AI workers.
 * Estimated value is carried beside it and never enters it. The data is synthetic and the thresholds below are a
 * policy choice, not a measurement. Nothing here is stored: it is derived from the records every time.
 */

export const ROI_POLICY = {
  /** At or above this verified multiple a worker pays off. */
  greenAt: 3,
  /** Below this verified multiple a worker costs more than it has been shown to earn. */
  redBelow: 1,
} as const

export type RoiStatus = 'green' | 'amber' | 'red' | 'grey'

export const ROI_LABEL: Record<RoiStatus, string> = {
  green: 'Pays off',
  amber: 'Thin or unproven',
  red: 'Not paying off',
  grey: 'No evidence',
}

export const ROI_ACTION: Record<RoiStatus, string> = {
  green: 'Keep',
  amber: 'Review',
  red: 'Pause or fix',
  grey: 'Measure first',
}

export const ROI_RANK: Record<RoiStatus, number> = { red: 0, amber: 1, grey: 2, green: 3 }

/** The same rule at every level: a verified multiple becomes a colour. */
export function statusForMultiple(multiple: number): Exclude<RoiStatus, 'grey'> {
  return multiple >= ROI_POLICY.greenAt ? 'green' : multiple < ROI_POLICY.redBelow ? 'red' : 'amber'
}

export interface WorkerReturn {
  workerId: string
  cost: number
  verified: number
  /** Unconfirmed, shown beside the return and never part of it. */
  estimated: number
  /** verified / cost, or null when nothing is verified. */
  multiple: number | null
  /** verified - cost per month. Meaningful only when something is verified. */
  net: number | null
  /** (verified - cost) / cost as a percentage. */
  roiPct: number | null
  valueClass: ValueClass
  costRising: boolean
  status: RoiStatus
}

export interface GroupReturn {
  workers: number
  cost: number
  verified: number
  estimated: number
  multiple: number | null
  net: number | null
  roiPct: number | null
  status: RoiStatus
  counts: Record<RoiStatus, number>
  /** Monthly cost of workers with no verified value: the spend nobody has confirmed. */
  unprovenCost: number
}

export interface RoiModel {
  byWorker: Map<string, WorkerReturn>
}

/** Computed once per state; every roll-up below reads it. Only active AI workers have a return. */
export function buildRoi(state: AppState): RoiModel {
  const classes = classifyAiWorkers(state)
  const verified = new Map<string, number>()
  const estimated = new Map<string, number>()
  for (const v of state.values) {
    const into = v.basis === 'verified' ? verified : estimated
    into.set(v.workerId, (into.get(v.workerId) ?? 0) + v.amount)
  }
  const byWorker = new Map<string, WorkerReturn>()
  for (const w of state.workers) {
    const valueClass = classes.get(w.id)
    if (w.kind !== 'ai' || !valueClass) continue
    const cost = w.monthlyCost
    const ver = verified.get(w.id) ?? 0
    const est = estimated.get(w.id) ?? 0
    const costRising = w.priorMonthlyCost !== undefined && w.priorMonthlyCost > 0 && w.monthlyCost / w.priorMonthlyCost - 1 >= COST_RISE
    let status: RoiStatus
    if (ver > 0 && cost > 0) status = statusForMultiple(ver / cost)
    else if (costRising) status = 'red'
    else status = valueClass === 'estimatedOnly' ? 'amber' : 'grey'
    byWorker.set(w.id, {
      workerId: w.id,
      cost,
      verified: ver,
      estimated: est,
      multiple: ver > 0 && cost > 0 ? ver / cost : null,
      net: ver > 0 ? ver - cost : null,
      roiPct: ver > 0 && cost > 0 ? ((ver - cost) / cost) * 100 : null,
      valueClass,
      costRising,
      status,
    })
  }
  return { byWorker }
}

export function groupReturn(model: RoiModel, workers: Worker[]): GroupReturn {
  const counts: Record<RoiStatus, number> = { green: 0, amber: 0, red: 0, grey: 0 }
  let cost = 0
  let verified = 0
  let estimated = 0
  let unprovenCost = 0
  let n = 0
  for (const w of workers) {
    const r = model.byWorker.get(w.id)
    if (!r) continue
    n += 1
    counts[r.status] += 1
    cost += r.cost
    verified += r.verified
    estimated += r.estimated
    if (r.verified === 0) unprovenCost += r.cost
  }
  const multiple = verified > 0 && cost > 0 ? verified / cost : null
  return {
    workers: n,
    cost,
    verified,
    estimated,
    multiple,
    net: verified > 0 ? verified - cost : null,
    roiPct: multiple === null ? null : (multiple - 1) * 100,
    // With verified value the group is judged by its return. With none, it is as bad as its worst member:
    // a mission of unproven workers whose cost is rising is red, not "no data".
    status: multiple !== null ? statusForMultiple(multiple) : counts.red > 0 ? 'red' : counts.amber > 0 ? 'amber' : 'grey',
    counts,
    unprovenCost,
  }
}

export const companyReturn = (state: AppState, model: RoiModel) => groupReturn(model, state.workers)
export const teamReturn = (state: AppState, model: RoiModel, teamId: string) => groupReturn(model, state.workers.filter((w) => w.teamId === teamId))
export const missionReturn = (state: AppState, model: RoiModel, missionId: string) => groupReturn(model, state.workers.filter((w) => w.missionId === missionId))
/** A person has no value records of their own; this is the return of the AI workers they are accountable for. */
export const ownerReturn = (state: AppState, model: RoiModel, humanId: string) => groupReturn(model, state.workers.filter((w) => w.ownerId === humanId))

/** Workers a manager should look at, worst first, biggest spend first within a colour. */
export function reviewList(state: AppState, model: RoiModel, only?: RoiStatus[]): Worker[] {
  const want = new Set<RoiStatus>(only ?? ['red', 'amber'])
  return state.workers
    .filter((w) => {
      const r = model.byWorker.get(w.id)
      return !!r && want.has(r.status)
    })
    .sort((a, b) => {
      const ra = model.byWorker.get(a.id)!
      const rb = model.byWorker.get(b.id)!
      return ROI_RANK[ra.status] - ROI_RANK[rb.status] || rb.cost - ra.cost
    })
}

export const fmtMultiple = (m: number | null) => (m === null ? 'no verified value' : `${m >= 10 ? m.toFixed(0) : m.toFixed(1)}×`)

/** One plain sentence a manager can read aloud. */
export function verdict(r: WorkerReturn, source?: string): string {
  const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
  switch (r.status) {
    case 'green':
      return `Pays for itself ${fmtMultiple(r.multiple)}: ${usd(r.verified)} confirmed against ${usd(r.cost)} a month${source ? `, per ${source}` : ''}.`
    case 'amber':
      return r.multiple !== null
        ? `Earns ${fmtMultiple(r.multiple)} on verified value, below the ${ROI_POLICY.greenAt}× target. Worth a review.`
        : `Only estimated value (${usd(r.estimated)}), nothing confirmed. The spend is unproven.`
    case 'red':
      return r.multiple !== null
        ? `Costs ${usd(r.cost)} a month and has only ${usd(r.verified)} of verified value (${fmtMultiple(r.multiple)}). It is not paying for itself.`
        : `Costs ${usd(r.cost)} a month with no verified value, and that cost is rising. Pause it or get proof.`
    default:
      return `No value data of any kind for ${usd(r.cost)} a month. This is missing evidence, not a verdict.`
  }
}
