import type {
  AuditEvent,
  AuthorizationEvaluatedEvent,
  Decision,
  PermissionChangedEvent,
  ReasonCode,
  ScopeState,
} from './types'

/*
 * Prototype policy: authorization must be valid at the instant a consequential
 * action executes. Revocation before execution prevents the action.
 * Browser simulation only - not production-grade security.
 *
 * Permissions are never stored as mutable state. They are folded from the
 * append-only event log. Order is defined by `seq` alone (timestamps are display-only
 * and may tie), and "as of X" means events with seq <= X.
 */

export function isPermissionChange(e: AuditEvent): e is PermissionChangedEvent {
  return e.type === 'PermissionChanged'
}

/** Permission changes for one worker (optionally one scope), in seq order, up to the cutoff. */
export function permissionChangesAsOf(
  events: AuditEvent[],
  workerId: string,
  cutoffSeq: number,
  scope?: string,
): PermissionChangedEvent[] {
  return events
    .filter(isPermissionChange)
    .filter((e) => e.workerId === workerId && e.seq <= cutoffSeq && (scope === undefined || e.scope === scope))
    .sort((a, b) => a.seq - b.seq)
}

function fold(changes: PermissionChangedEvent[]): ScopeState {
  let state: ScopeState = { active: false }
  for (const c of changes) {
    if (c.action === 'grant') state = { active: true, limit: c.limit }
    else if (c.action === 'modify') {
      // modify only changes the limit of an active scope; the reducer never writes an invalid one
      if (state.active) state = { active: true, limit: c.limit }
    } else state = { active: false }
  }
  return state
}

export function scopeStateAsOf(
  events: AuditEvent[],
  workerId: string,
  scope: string,
  cutoffSeq: number,
): { state: ScopeState; evidence: PermissionChangedEvent[] } {
  const evidence = permissionChangesAsOf(events, workerId, cutoffSeq, scope)
  return { state: fold(evidence), evidence }
}

/** Full permission picture for a worker as of a cutoff: one ScopeState per scope ever touched. */
export function permissionsAsOf(
  events: AuditEvent[],
  workerId: string,
  cutoffSeq: number,
): Record<string, ScopeState> {
  const byScope = new Map<string, PermissionChangedEvent[]>()
  for (const c of permissionChangesAsOf(events, workerId, cutoffSeq)) {
    const list = byScope.get(c.scope) ?? []
    list.push(c)
    byScope.set(c.scope, list)
  }
  const out: Record<string, ScopeState> = {}
  for (const [scope, list] of byScope) out[scope] = fold(list)
  return out
}

export interface AuthorizationRequest {
  workerId: string
  requiredScope: string
  amount: number
}

export interface AuthorizationResult {
  decision: Decision
  reasonCode: ReasonCode
  scopeState: ScopeState
  evidenceChangeIds: string[]
}

export function authorize(events: AuditEvent[], req: AuthorizationRequest, cutoffSeq: number): AuthorizationResult {
  const { state, evidence } = scopeStateAsOf(events, req.workerId, req.requiredScope, cutoffSeq)
  const evidenceChangeIds = evidence.map((e) => e.id)
  let decision: Decision = 'allowed'
  let reasonCode: ReasonCode = 'ACTIVE_GRANT'
  if (evidence.length === 0) {
    decision = 'denied'
    reasonCode = 'NO_GRANT'
  } else if (!state.active) {
    decision = 'denied'
    reasonCode = 'REVOKED'
  } else if (state.limit !== undefined && req.amount > state.limit) {
    decision = 'denied'
    reasonCode = 'LIMIT_EXCEEDED'
  }
  return { decision, reasonCode, scopeState: state, evidenceChangeIds }
}

/**
 * Replay check: recompute the decision from the log at the stored cutoff and compare it
 * with what was recorded. History views render the stored decision; this only verifies it.
 */
export function replayMatches(events: AuditEvent[], evaluation: AuthorizationEvaluatedEvent): boolean {
  if (!evaluation.workerId) return false
  const again = authorize(
    events,
    { workerId: evaluation.workerId, requiredScope: evaluation.requiredScope, amount: evaluation.amount },
    evaluation.cutoffSeq,
  )
  return (
    again.decision === evaluation.decision &&
    again.reasonCode === evaluation.reasonCode &&
    again.scopeState.active === evaluation.scopeState.active &&
    again.scopeState.limit === evaluation.scopeState.limit &&
    again.evidenceChangeIds.join('|') === evaluation.evidenceChangeIds.join('|')
  )
}
