import { authorityAtRisk, blockedOperations, classifyAiWorkers, openConflicts, REASON_SHORT, SEVERITY_RANK } from './selectors'
import { formatUtc, span, usd } from './format'
import type { AppState, Mission, Operation, Severity, Worker } from './types'

/*
 * Findings: what leadership should look at, derived from live state every time.
 * Nothing here is stored. Resolving the underlying issue (a reassigned decision, a resolved conflict,
 * paused workers, restored authority) makes the finding disappear because the data no longer matches.
 */

export type FindingKind = 'blocked-decision' | 'conflicting-objectives' | 'duplicate-work' | 'cost-without-proof' | 'authority-at-risk'

export interface EntityRef {
  kind: 'worker' | 'human' | 'op' | 'mission' | 'conflict' | 'team'
  id: string
}

export interface ChainLink {
  label: string
  detail: string
  ref?: EntityRef
}

export interface Reach {
  workerIds: string[]
  humanIds: string[]
  teamIds: string[]
  missionIds: string[]
  opIds: string[]
  conflictIds: string[]
}

export interface Finding {
  id: string
  kind: FindingKind
  severity: Severity
  title: string
  /** What it costs the business if nothing happens. */
  consequence: string
  chain: ChainLink[]
  reach: Reach
}

const emptyReach = (): Reach => ({ workerIds: [], humanIds: [], teamIds: [], missionIds: [], opIds: [], conflictIds: [] })
const uniq = <T,>(xs: T[]) => [...new Set(xs)]

export { formatUtc, span }

export const isUnavailable = (w: Worker | undefined) => w?.availability?.status === 'out_of_office'

export function missionMembers(state: AppState, missionId: string): Worker[] {
  return state.workers.filter((w) => w.missionId === missionId)
}

export interface MissionSummary {
  mission: Mission
  members: number
  active: number
  verified: number
  estimatedOnly: number
  unmeasured: number
  cost: number
  priorCost: number
  openConflicts: number
  blockedOps: number
}

export function missionSummary(state: AppState, mission: Mission): MissionSummary {
  const classes = classifyAiWorkers(state)
  const members = missionMembers(state, mission.id)
  const ids = new Set(members.map((w) => w.id))
  const count = (c: string) => members.filter((w) => classes.get(w.id) === c).length
  return {
    mission,
    members: members.length,
    active: members.filter((w) => w.status === 'active').length,
    verified: count('verified'),
    estimatedOnly: count('estimatedOnly'),
    unmeasured: count('unmeasured'),
    cost: members.filter((w) => w.status === 'active').reduce((a, w) => a + w.monthlyCost, 0),
    priorCost: members.reduce((a, w) => a + (w.priorMonthlyCost ?? w.monthlyCost), 0),
    openConflicts: openConflicts(state).filter((c) => ids.has(c.workerAId) || ids.has(c.workerBId)).length,
    blockedOps: blockedOperations(state).filter((o) => ids.has(o.workerId)).length,
  }
}

/** Available people who could take a blocked decision: the executor's team first, then the head of the team, then the executive. */
export function suggestedDelegates(state: AppState, op: Operation): Worker[] {
  const worker = state.workers.find((w) => w.id === op.workerId)
  const humans = state.workers.filter((w) => w.kind === 'human' && w.id !== op.decisionOwnerId && !isUnavailable(w))
  const sameTeam = humans.filter((h) => h.teamId === worker?.teamId)
  const lead = sameTeam.find((h) => h.ownerId && state.workers.find((x) => x.id === h.ownerId)?.ownerId === null)
  const exec = humans.find((h) => h.ownerId === null)
  return uniq([...sameTeam.slice(0, 3), ...(exec ? [exec] : [])].concat(lead ? [lead] : [])).slice(0, 4)
}

/* ---------- builders ---------- */

function blockedDecisionFindings(state: AppState): Finding[] {
  const by = new Map(state.workers.map((w) => [w.id, w]))
  return blockedOperations(state)
    .filter((op) => isUnavailable(by.get(op.decisionOwnerId)))
    .map((op) => {
      const owner = by.get(op.decisionOwnerId)!
      const worker = by.get(op.workerId)
      const since = op.awaitingSince ?? op.startedAt
      const chain: ChainLink[] = [
        { label: 'Blocked operation', detail: `${op.title} has been waiting ${span(since, state.clock)} for a human decision.`, ref: { kind: 'op', id: op.id } },
        {
          label: 'Decision owner',
          detail: `${owner.name} (${owner.role}) is out of office${owner.availability?.until ? ` until ${formatUtc(owner.availability.until)}` : ''}. ${owner.availability?.note ?? ''}`.trim(),
          ref: { kind: 'human', id: owner.id },
        },
      ]
      if (op.dueAt) chain.push({ label: 'Deadline', detail: `Due ${formatUtc(op.dueAt)}, in ${span(state.clock, op.dueAt)}.` })
      chain.push({ label: 'Executing worker', detail: `${worker?.name} has done its part and cannot proceed without the decision.`, ref: { kind: 'worker', id: op.workerId } })

      // Downstream: what else is held by the same person, and which mission the work belongs to. Both are derived.
      const others = blockedOperations(state).filter((o) => o.id !== op.id && o.decisionOwnerId === owner.id)
      const mission = state.missions.find((m) => m.id === worker?.missionId)
      if (mission) {
        chain.push({ label: 'Mission at risk', detail: `${mission.name}: ${mission.objective}`, ref: { kind: 'mission', id: mission.id } })
      }
      if (others.length > 0) {
        const total = others.reduce((a, o) => a + o.amount, 0)
        chain.push({
          label: 'Also waiting on them',
          detail: `${others.length} other blocked operation${others.length === 1 ? '' : 's'} (${usd(total)}) also wait on ${owner.name}: ${others.slice(0, 3).map((o) => o.title).join('; ')}${others.length > 3 ? '; and more' : ''}.`,
        })
      }
      return {
        id: `blocked:${op.id}`,
        kind: 'blocked-decision' as const,
        severity: op.severity,
        title: `${op.title} is blocked because ${owner.name} is unavailable`,
        consequence: op.consequence ?? `${usd(op.amount)} waits on a decision nobody can currently take.`,
        chain,
        reach: { ...emptyReach(), workerIds: [op.workerId], humanIds: [owner.id], teamIds: uniq([worker?.teamId ?? '', owner.teamId]), missionIds: mission ? [mission.id] : [], opIds: [op.id] },
      }
    })
}

function conflictFindings(state: AppState): Finding[] {
  const by = new Map(state.workers.map((w) => [w.id, w]))
  const mission = new Map(state.missions.map((m) => [m.id, m]))
  return openConflicts(state).map((c) => {
    const a = by.get(c.workerAId)!
    const b = by.get(c.workerBId)!
    const ma = c.missionAId ? mission.get(c.missionAId) : undefined
    const mb = c.missionBId ? mission.get(c.missionBId) : undefined
    const chain: ChainLink[] = []
    if (ma && mb) {
      chain.push(
        { label: 'Mission A', detail: `${ma.name}: ${ma.objective}`, ref: { kind: 'mission', id: ma.id } },
        { label: 'Mission B', detail: `${mb.name}: ${mb.objective}`, ref: { kind: 'mission', id: mb.id } },
      )
    }
    chain.push(
      { label: 'Contested resource', detail: `${c.resource}. ${c.summary}`, ref: { kind: 'conflict', id: c.id } },
      { label: 'Worker A', detail: `${a.name} (${a.role}), accountable owner ${by.get(a.ownerId ?? '')?.name ?? 'none'}.`, ref: { kind: 'worker', id: a.id } },
      { label: 'Worker B', detail: `${b.name} (${b.role}), accountable owner ${by.get(b.ownerId ?? '')?.name ?? 'none'}.`, ref: { kind: 'worker', id: b.id } },
    )
    const duplicate = c.kind === 'duplicate'
    const owners = uniq([a.ownerId, b.ownerId, ma?.ownerId, mb?.ownerId].filter((x): x is string => !!x))
    return {
      id: `conflict:${c.id}`,
      kind: duplicate ? ('duplicate-work' as const) : ('conflicting-objectives' as const),
      severity: c.severity,
      title: duplicate ? `${a.name} and ${b.name} are duplicating work on ${c.resource}` : `${ma && mb ? `${ma.name} and ${mb.name}` : `${a.name} and ${b.name}`} are working against each other on ${c.resource}`,
      consequence: duplicate
        ? `Both workers spend run cost (${usd(a.monthlyCost + b.monthlyCost)} per month combined, modeled) on the same work, and their outputs can collide.`
        : 'Each worker undoes the other’s result until someone decides which one is authoritative for this resource.',
      chain,
      reach: {
        ...emptyReach(),
        workerIds: [a.id, b.id],
        humanIds: owners,
        teamIds: uniq([a.teamId, b.teamId]),
        missionIds: [ma?.id, mb?.id].filter((x): x is string => !!x),
        conflictIds: [c.id],
      },
    }
  })
}

export const COST_RISE = 0.25
const COST_MIN_WORKERS = 5

function costFindings(state: AppState): Finding[] {
  const classes = classifyAiWorkers(state)
  const by = new Map(state.workers.map((w) => [w.id, w]))
  return state.missions.flatMap((m) => {
    const flagged = missionMembers(state, m.id).filter(
      (w) => w.status === 'active' && classes.get(w.id) !== 'verified' && w.priorMonthlyCost !== undefined && w.monthlyCost / w.priorMonthlyCost - 1 >= COST_RISE,
    )
    if (flagged.length < COST_MIN_WORKERS) return []
    const now = flagged.reduce((a, w) => a + w.monthlyCost, 0)
    const before = flagged.reduce((a, w) => a + (w.priorMonthlyCost ?? 0), 0)
    const ids = new Set(flagged.map((w) => w.id))
    const estimated = state.values.filter((v) => v.basis === 'estimated' && ids.has(v.workerId)).reduce((a, v) => a + v.amount, 0)
    const owner = by.get(m.ownerId)
    const rise = (now - before) / before
    return [
      {
        id: `cost:${m.id}`,
        kind: 'cost-without-proof' as const,
        severity: (now - before >= 3000 ? 'high' : 'medium') as Severity,
        title: `${m.name}: modeled run cost up ${Math.round(rise * 100)}% across ${flagged.length} workers, none with verified value`,
        consequence: `${usd(now - before)} more per month (simulated comparison) is being spent with nothing confirmed in a system of record.`,
        chain: [
          { label: 'Mission', detail: `${m.name}: ${m.objective} Owned by ${owner?.name ?? 'nobody'}.`, ref: { kind: 'mission' as const, id: m.id } },
          { label: 'Cost', detail: `${flagged.length} workers cost ${usd(now)} per month now against ${usd(before)} in the previous 30 days. Both figures are modeled, not measured.` },
          { label: 'Verified value', detail: `No worker in this group has a verified value record. ${estimated > 0 ? `Model-based estimates total ${usd(estimated)} and are not counted as verified.` : 'There are no estimates either.'}` },
          { label: 'Decision', detail: 'Pause the workers until the owner can show confirmed outcomes, or accept the spend knowingly.' },
        ],
        reach: { ...emptyReach(), workerIds: flagged.map((w) => w.id), humanIds: uniq([m.ownerId, ...flagged.map((w) => w.ownerId).filter((x): x is string => !!x)]), teamIds: uniq(flagged.map((w) => w.teamId)), missionIds: [m.id] },
      },
    ]
  })
}

function authorityFindings(state: AppState): Finding[] {
  const by = new Map(state.workers.map((w) => [w.id, w]))
  return authorityAtRisk(state).map((r) => {
    const worker = by.get(r.op.workerId)
    const last = r.changedDuringCase[r.changedDuringCase.length - 1]
    const owner = by.get(worker?.ownerId ?? '')
    return {
      id: `risk:${r.op.id}`,
      kind: 'authority-at-risk' as const,
      severity: r.op.severity,
      title: `${r.op.title} would be denied if it ran now`,
      consequence: `If it runs as things stand it will be prevented (${REASON_SHORT[r.liveDecision!.reasonCode].toLowerCase()}), and ${usd(r.op.amount)} of work stalls at execution.`,
      chain: [
        { label: 'In-progress operation', detail: `${r.op.title} is staged and ready to run.`, ref: { kind: 'op' as const, id: r.op.id } },
        { label: 'Permission now', detail: `${worker?.name}'s authority for this action is ${r.liveDecision!.scopeState.active ? `limited to ${usd(r.liveDecision!.scopeState.limit ?? 0)}` : 'revoked'}.`, ref: { kind: 'worker' as const, id: r.op.workerId } },
        ...(last ? [{ label: 'Change recorded', detail: `Permission ${last.action} by ${last.actor} at #${last.seq}: ${last.reason}.` }] : []),
        { label: 'Accountable owner', detail: `${owner?.name ?? 'No owner'} owns ${worker?.name}.`, ref: owner ? { kind: 'human' as const, id: owner.id } : undefined },
      ],
      reach: { ...emptyReach(), workerIds: [r.op.workerId], humanIds: owner ? [owner.id] : [], teamIds: worker ? [worker.teamId] : [], opIds: [r.op.id] },
    }
  })
}

const KIND_ORDER: Record<FindingKind, number> = {
  'blocked-decision': 0,
  'conflicting-objectives': 1,
  'authority-at-risk': 2,
  'cost-without-proof': 3,
  'duplicate-work': 4,
}

/** Ranked: severity first, then kind, then how many workers it touches. */
export function findings(state: AppState): Finding[] {
  return [...blockedDecisionFindings(state), ...conflictFindings(state), ...costFindings(state), ...authorityFindings(state)].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || b.reach.workerIds.length - a.reach.workerIds.length,
  )
}

export const FINDING_LABEL: Record<FindingKind, string> = {
  'blocked-decision': 'Blocked decision',
  'conflicting-objectives': 'Conflicting objectives',
  'duplicate-work': 'Duplicated work',
  'cost-without-proof': 'Cost without verified value',
  'authority-at-risk': 'Permission changed',
}
