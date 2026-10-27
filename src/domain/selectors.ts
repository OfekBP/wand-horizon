import { authorize, isPermissionChange, permissionChangesAsOf, replayMatches, type AuthorizationResult } from './authorize'
import type {
  AppState,
  AuditEvent,
  AuthorizationEvaluatedEvent,
  Conflict,
  Operation,
  PerformanceConcern,
  PermissionChangedEvent,
  ReasonCode,
  ScopeState,
  Severity,
  Team,
  Worker,
} from './types'

export const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 }

export interface Index {
  workerById: Map<string, Worker>
  teamById: Map<string, Team>
  opById: Map<string, Operation>
}

export function buildIndex(state: AppState): Index {
  return {
    workerById: new Map(state.workers.map((w) => [w.id, w])),
    teamById: new Map(state.teams.map((t) => [t.id, t])),
    opById: new Map(state.operations.map((o) => [o.id, o])),
  }
}

/* ---------- value and cost ---------- */

export type ValueClass = 'verified' | 'estimatedOnly' | 'unmeasured'

/** Every active AI worker falls in exactly one class. */
export function classifyAiWorkers(state: AppState): Map<string, ValueClass> {
  const hasVerified = new Set<string>()
  const hasEstimated = new Set<string>()
  for (const v of state.values) (v.basis === 'verified' ? hasVerified : hasEstimated).add(v.workerId)
  const out = new Map<string, ValueClass>()
  for (const w of state.workers) {
    if (w.kind !== 'ai' || w.status !== 'active') continue
    out.set(w.id, hasVerified.has(w.id) ? 'verified' : hasEstimated.has(w.id) ? 'estimatedOnly' : 'unmeasured')
  }
  return out
}

export interface Metrics {
  humans: number
  aiWorkers: number
  activeAi: number
  verifiedValue: number
  estimatedValue: number
  unmeasuredWorkers: number
  estimatedOnlyWorkers: number
  verifiedWorkers: number
  /** verified coverage = verifiedWorkers / activeAi (worker count, not dollar-weighted) */
  coverage: number
  aiCost: number
  humanCost: number
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

export function overviewMetrics(state: AppState): Metrics {
  const classes = classifyAiWorkers(state)
  const count = (c: ValueClass) => [...classes.values()].filter((x) => x === c).length
  const aiWorkers = state.workers.filter((w) => w.kind === 'ai')
  const activeAi = classes.size
  const verifiedWorkers = count('verified')
  return {
    humans: state.workers.filter((w) => w.kind === 'human').length,
    aiWorkers: aiWorkers.length,
    activeAi,
    verifiedValue: sum(state.values.filter((v) => v.basis === 'verified' && classes.has(v.workerId)).map((v) => v.amount)),
    estimatedValue: sum(state.values.filter((v) => v.basis === 'estimated' && classes.has(v.workerId)).map((v) => v.amount)),
    unmeasuredWorkers: count('unmeasured'),
    estimatedOnlyWorkers: count('estimatedOnly'),
    verifiedWorkers,
    coverage: activeAi === 0 ? 0 : verifiedWorkers / activeAi,
    // paused workers stop incurring run cost, so the run-rate counts active workers only
    aiCost: sum(aiWorkers.filter((w) => w.status === 'active').map((w) => w.monthlyCost)),
    humanCost: sum(state.workers.filter((w) => w.kind === 'human').map((w) => w.monthlyCost)),
  }
}

export interface TeamRow {
  team: Team
  humans: number
  aiWorkers: number
  verifiedValue: number
  estimatedValue: number
  aiCost: number
  coverage: number
  openIssues: number
}

export function teamPerformance(state: AppState): TeamRow[] {
  const idx = buildIndex(state)
  const classes = classifyAiWorkers(state)
  const blocked = blockedOperations(state)
  const conflicts = openConflicts(state)
  const concerns = openConcerns(state)
  return state.teams.map((team) => {
    const members = state.workers.filter((w) => w.teamId === team.id)
    const aiMembers = members.filter((w) => w.kind === 'ai')
    const ids = new Set(aiMembers.map((w) => w.id))
    const active = aiMembers.filter((w) => classes.has(w.id))
    const teamOf = (workerId: string) => idx.workerById.get(workerId)?.teamId
    return {
      team,
      humans: members.length - aiMembers.length,
      aiWorkers: aiMembers.length,
      verifiedValue: sum(state.values.filter((v) => v.basis === 'verified' && ids.has(v.workerId)).map((v) => v.amount)),
      estimatedValue: sum(state.values.filter((v) => v.basis === 'estimated' && ids.has(v.workerId)).map((v) => v.amount)),
      aiCost: sum(aiMembers.filter((w) => w.status === 'active').map((w) => w.monthlyCost)),
      coverage: active.length === 0 ? 0 : active.filter((w) => classes.get(w.id) === 'verified').length / active.length,
      openIssues:
        blocked.filter((o) => teamOf(o.workerId) === team.id).length +
        conflicts.filter((c) => teamOf(c.workerAId) === team.id || teamOf(c.workerBId) === team.id).length +
        concerns.filter((c) => teamOf(c.workerId) === team.id).length,
    }
  })
}

/* ---------- work queue ---------- */

/** Blocked is derived: an operation is blocked exactly when it is awaiting approval. */
export const isBlocked = (o: Operation) => o.status === 'awaiting_approval'

const bySeverityThen = <T extends { severity: Severity }>(tie: (a: T, b: T) => number) => (a: T, b: T) =>
  SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || tie(a, b)

export function blockedOperations(state: AppState): Operation[] {
  return state.operations
    .filter(isBlocked)
    .sort(bySeverityThen<Operation>((a, b) => Date.parse(a.awaitingSince ?? a.startedAt) - Date.parse(b.awaitingSince ?? b.startedAt)))
}

export function openConflicts(state: AppState): Conflict[] {
  return state.conflicts
    .filter((c) => c.status === 'open')
    .sort(bySeverityThen<Conflict>((a, b) => Date.parse(a.detectedAt) - Date.parse(b.detectedAt)))
}

export function openConcerns(state: AppState): PerformanceConcern[] {
  return state.concerns
    .filter((c) => c.status === 'open')
    .sort(bySeverityThen<PerformanceConcern>((a, b) => b.observed / b.threshold - a.observed / a.threshold))
}

export type IssueKind = 'blocked' | 'conflict' | 'concern'
export interface Issue {
  kind: IssueKind
  id: string
  severity: Severity
  title: string
  detail: string
  /** ISO time the issue began, for age display. */
  since: string
}

/** The Overview's "needs attention" list: the most severe open items across the queue. */
export function criticalIssues(state: AppState, limit = 6): Issue[] {
  const idx = buildIndex(state)
  const name = (id: string) => idx.workerById.get(id)?.name ?? id
  const issues: Issue[] = [
    ...blockedOperations(state).map<Issue>((o) => ({
      kind: 'blocked', id: o.id, severity: o.severity, title: o.title,
      detail: `Awaiting ${name(o.decisionOwnerId)} · ${o.blockReason ?? 'decision pending'}`,
      since: o.awaitingSince ?? o.startedAt,
    })),
    ...openConflicts(state).map<Issue>((c) => ({
      kind: 'conflict', id: c.id, severity: c.severity, title: `Conflict on ${c.resource}`,
      detail: `${name(c.workerAId)} vs ${name(c.workerBId)}`, since: c.detectedAt,
    })),
  ]
  return issues.sort(bySeverityThen<Issue>((a, b) => Date.parse(a.since) - Date.parse(b.since))).slice(0, limit)
}

export function queueCounts(state: AppState) {
  return {
    blocked: blockedOperations(state).length,
    criticalBlocked: blockedOperations(state).filter((o) => o.severity === 'critical').length,
    conflicts: openConflicts(state).length,
    concerns: openConcerns(state).length,
  }
}

/* ---------- workforce ---------- */

export interface WorkerFilter {
  q: string
  kind: 'all' | 'human' | 'ai'
  teamId: string
  status: 'all' | 'active' | 'paused'
  /** Value measurement class of AI workers. Anything other than 'all' leaves out people. */
  value: 'all' | ValueClass
}

export function filterWorkers(state: AppState, f: WorkerFilter): Worker[] {
  const q = f.q.trim().toLowerCase()
  const classes = f.value === 'all' ? null : classifyAiWorkers(state)
  return state.workers.filter(
    (w) =>
      (classes === null || classes.get(w.id) === f.value) &&
      (f.kind === 'all' || w.kind === f.kind) &&
      (f.teamId === 'all' || w.teamId === f.teamId) &&
      (f.status === 'all' || w.status === f.status) &&
      (q === '' || w.name.toLowerCase().includes(q) || w.role.toLowerCase().includes(q) || w.id.toLowerCase().includes(q)),
  )
}

/* ---------- governance ---------- */

export function operationEvents(state: AppState, operationId: string): AuditEvent[] {
  return state.events.filter((e) => e.operationId === operationId).sort((a, b) => a.seq - b.seq)
}

/**
 * Full lineage for an operation: its own events merged with every permission change for the
 * executor's required scope (including changes made before it started and after it finished).
 */
export function operationTimeline(state: AppState, op: Operation): AuditEvent[] {
  const changes = permissionChangesAsOf(state.events, op.workerId, Number.MAX_SAFE_INTEGER, op.requiredScope)
  return [...operationEvents(state, op.id), ...changes].sort((a, b) => a.seq - b.seq)
}

export function operationOutcomeSeq(events: AuditEvent[]): number | null {
  const out = events.find((e) => e.type === 'OperationExecuted' || e.type === 'ExecutionPrevented')
  return out ? out.seq : null
}

/* ---------- cases: the operation as both a managed object and a record to prove ---------- */

/** Short reason wording for dense rows. The full wording lives in audit.ts. */
export const REASON_SHORT: Record<ReasonCode, string> = {
  ACTIVE_GRANT: 'Active grant',
  NO_GRANT: 'Never granted',
  REVOKED: 'Revoked',
  LIMIT_EXCEEDED: 'Limit exceeded',
}

const isEvaluation = (e: AuditEvent): e is AuthorizationEvaluatedEvent => e.type === 'AuthorizationEvaluated'
const MAX_SEQ = Number.MAX_SAFE_INTEGER

export interface CaseRow {
  op: Operation
  /** The stored execution-time decision, if the operation has been attempted. */
  evaluation?: AuthorizationEvaluatedEvent
  /** Permission changes for this worker and scope recorded after the operation started. */
  changedDuringCase: PermissionChangedEvent[]
  /** For in-progress operations: what authorization would say if it ran right now. Not a recorded decision. */
  liveDecision?: AuthorizationResult
  /** One line for dense rows: the authority story of this case. */
  authorityNote: string
}

export function caseRows(state: AppState): CaseRow[] {
  const latest = state.nextSeq - 1
  const startSeq = new Map<string, number>()
  const evalByOp = new Map<string, AuthorizationEvaluatedEvent>()
  const changesByKey = new Map<string, PermissionChangedEvent[]>()
  for (const e of state.events) {
    if (e.type === 'OperationStarted' && e.operationId) startSeq.set(e.operationId, e.seq)
    else if (isEvaluation(e) && e.operationId) evalByOp.set(e.operationId, e)
    else if (isPermissionChange(e) && e.workerId) {
      const key = `${e.workerId}|${e.scope}`
      changesByKey.set(key, [...(changesByKey.get(key) ?? []), e])
    }
  }
  return state.operations.map((op) => {
    const evaluation = evalByOp.get(op.id)
    const from = startSeq.get(op.id) ?? 0
    const changedDuringCase = (changesByKey.get(`${op.workerId}|${op.requiredScope}`) ?? []).filter((c) => c.seq > from)
    let liveDecision: AuthorizationResult | undefined
    let authorityNote: string
    if (evaluation) {
      authorityNote = `${evaluation.decision === 'allowed' ? 'Allowed' : 'Denied'} · ${REASON_SHORT[evaluation.reasonCode]} · decided at #${evaluation.seq}`
    } else if (op.status === 'in_progress') {
      liveDecision = authorize(state.events, { workerId: op.workerId, requiredScope: op.requiredScope, amount: op.amount }, latest)
      authorityNote =
        liveDecision.decision === 'allowed'
          ? 'Would be allowed if run now'
          : `Would be denied if run now · ${REASON_SHORT[liveDecision.reasonCode]}`
    } else {
      authorityNote = 'Waiting on a human decision. Not executable.'
    }
    return { op, evaluation, changedDuringCase, liveDecision, authorityNote }
  })
}

/** In-progress operations whose authority would be denied if they ran now. Derived, never stored. */
export function authorityAtRisk(state: AppState): CaseRow[] {
  return caseRows(state)
    .filter((r) => r.op.status === 'in_progress' && r.liveDecision?.decision === 'denied')
    .sort((a, b) => SEVERITY_RANK[a.op.severity] - SEVERITY_RANK[b.op.severity] || b.op.amount - a.op.amount)
}

export type CaseSegment = 'all' | 'prevented' | 'changed' | 'executed' | 'open'

export function inSegment(row: CaseRow, segment: CaseSegment): boolean {
  switch (segment) {
    case 'all':
      return true
    case 'prevented':
      return row.op.status === 'prevented'
    case 'executed':
      return row.op.status === 'executed'
    case 'open':
      return row.op.status === 'in_progress' || row.op.status === 'awaiting_approval'
    case 'changed':
      return row.changedDuringCase.length > 0
  }
}

export interface ThenVsNow {
  stored: AuthorizationEvaluatedEvent
  /** Permission for the same worker and scope as of the latest event. */
  live: ScopeState
  /** What the same request would get today. */
  today: AuthorizationResult
  /** Permission changes recorded after the stored decision's cutoff. */
  changedSince: PermissionChangedEvent[]
}

/** The stored execution-time decision beside today's permission. The stored decision is never recomputed. */
export function thenVsNow(state: AppState, stored: AuthorizationEvaluatedEvent): ThenVsNow {
  const workerId = stored.workerId ?? ''
  const today = authorize(state.events, { workerId, requiredScope: stored.requiredScope, amount: stored.amount }, state.nextSeq - 1)
  const changedSince = permissionChangesAsOf(state.events, workerId, MAX_SEQ, stored.requiredScope).filter((c) => c.seq > stored.cutoffSeq)
  return { stored, live: today.scopeState, today, changedSince }
}

export interface GovernanceStats {
  attempts: number
  allowed: number
  denied: number
  deniedByReason: Record<ReasonCode, number>
  permissionChanges: number
  replayVerified: number
}

/** Counts from the event log for decisions and permission changes recorded since `sinceIso`. */
export function governanceStats(state: AppState, sinceIso: string): GovernanceStats {
  const since = Date.parse(sinceIso)
  const evals = state.events.filter(isEvaluation).filter((e) => Date.parse(e.at) >= since)
  const deniedByReason: Record<ReasonCode, number> = { ACTIVE_GRANT: 0, NO_GRANT: 0, REVOKED: 0, LIMIT_EXCEEDED: 0 }
  for (const e of evals) if (e.decision === 'denied') deniedByReason[e.reasonCode]++
  return {
    attempts: evals.length,
    allowed: evals.filter((e) => e.decision === 'allowed').length,
    denied: evals.filter((e) => e.decision === 'denied').length,
    deniedByReason,
    permissionChanges: state.events.filter(isPermissionChange).filter((e) => Date.parse(e.at) >= since).length,
    replayVerified: evals.filter((e) => replayMatches(state.events, e)).length,
  }
}
