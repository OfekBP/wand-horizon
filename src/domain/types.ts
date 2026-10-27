export type WorkerKind = 'human' | 'ai'
export type WorkerStatus = 'active' | 'paused'
export type Severity = 'critical' | 'high' | 'medium' | 'low'
export type ValueBasis = 'verified' | 'estimated'

/** The only operation statuses. "Blocked" is derived: blocked <=> awaiting_approval. */
export type OperationStatus = 'in_progress' | 'awaiting_approval' | 'executed' | 'prevented'
export type ConflictStatus = 'open' | 'resolved'
export type ConcernStatus = 'open' | 'acknowledged'
export type PermissionAction = 'grant' | 'modify' | 'revoke'
export type SimRole = 'executive' | 'manager' | 'investigator'
export type ReasonCode = 'ACTIVE_GRANT' | 'NO_GRANT' | 'REVOKED' | 'LIMIT_EXCEEDED'
export type Decision = 'allowed' | 'denied'

export interface Team {
  id: string
  name: string
}

export interface Worker {
  id: string
  kind: WorkerKind
  name: string
  role: string
  teamId: string
  status: WorkerStatus
  /** AI worker -> accountable human. Human -> manager (null for the top of the org). */
  ownerId: string | null
  responsibilities: string[]
  /** Synthetic monthly cost in USD. AI: modeled run cost. Human: loaded labor cost. */
  monthlyCost: number
  /** AI only. SIMULATED run cost for the previous 30 days, from the same cost model. Never a measurement. */
  priorMonthlyCost?: number
  /** AI only. The mission this worker is currently assigned to, if any. */
  missionId?: string
  /** People only. Whether this person can currently take decisions. */
  availability?: Availability
}

export interface Availability {
  status: 'available' | 'out_of_office'
  /** ISO time they are back. */
  until?: string
  note?: string
}

/** A mission groups AI workers, across teams, behind one objective and one accountable human. */
export interface Mission {
  id: string
  name: string
  objective: string
  ownerId: string
}

/** Value attaches to AI workers only. An AI worker with no records is "unmeasured". */
export interface ValueRecord {
  id: string
  workerId: string
  amount: number
  basis: ValueBasis
  source: string
}

export interface Operation {
  id: string
  title: string
  summary: string
  /** The AI worker executing the operation. */
  workerId: string
  /** The accountable human. While awaiting_approval this is who the decision is pending on. */
  decisionOwnerId: string
  status: OperationStatus
  severity: Severity
  /** Amount at stake in USD, compared against the permission limit at execution time. */
  amount: number
  requiredScope: string
  startedAt: string
  awaitingSince?: string
  blockReason?: string
  /** When the work must be done by, if there is a hard deadline. */
  dueAt?: string
  /** What happens to the business if it is not done. Synthetic, written for the demo. */
  consequence?: string
}

export interface ConflictResolution {
  authoritativeWorkerId: string
  note: string
  resolvedBy: string
  resolvedAt: string
}

/** duplicate: two workers do the same work. contradiction: two workers pursue opposing outcomes. */
export type ConflictKind = 'duplicate' | 'contradiction'

export interface Conflict {
  id: string
  kind: ConflictKind
  /** Set when the two workers belong to missions with opposing objectives. */
  missionAId?: string
  missionBId?: string
  workerAId: string
  workerBId: string
  resource: string
  summary: string
  severity: Severity
  detectedAt: string
  status: ConflictStatus
  resolution?: ConflictResolution
}

export interface PerformanceConcern {
  id: string
  workerId: string
  metric: string
  observed: number
  threshold: number
  unit: '%' | '$' | 'min'
  severity: Severity
  status: ConcernStatus
  note: string
}

/* ---------- Audit events (append-only). Permission changes ARE events. ---------- */

export interface ScopeState {
  active: boolean
  limit?: number
}

interface EventBase {
  id: string
  /** Global, strictly increasing. The only source of ordering; `at` is display-only. */
  seq: number
  at: string
  actor: string
  operationId?: string
  workerId?: string
}

export interface OperationStartedPayload {
  type: 'OperationStarted'
  initialStatus: OperationStatus
  ownerId: string
}
export interface OwnerReassignedPayload {
  type: 'OwnerReassigned'
  fromOwnerId: string
  toOwnerId: string
  reason: string
}
export interface ConflictResolvedPayload {
  type: 'ConflictResolved'
  conflictId: string
  authoritativeWorkerId: string
  note: string
}
export interface PermissionChangedPayload {
  type: 'PermissionChanged'
  scope: string
  action: PermissionAction
  limit?: number
  reason: string
}
export interface AuthorizationEvaluatedPayload {
  type: 'AuthorizationEvaluated'
  requiredScope: string
  amount: number
  decision: Decision
  reasonCode: ReasonCode
  /** Permission state is read from events with seq <= cutoffSeq. */
  cutoffSeq: number
  scopeState: ScopeState
  /** Ordered ids of every PermissionChanged event for this worker+scope up to the cutoff. */
  evidenceChangeIds: string[]
}
export interface OperationExecutedPayload {
  type: 'OperationExecuted'
  evaluationEventId: string
}
export interface ExecutionPreventedPayload {
  type: 'ExecutionPrevented'
  evaluationEventId: string
  reasonCode: ReasonCode
}

export interface WorkersPausedPayload {
  type: 'WorkersPaused'
  workerIds: string[]
  reason: string
}

export type EventPayload =
  | WorkersPausedPayload
  | OperationStartedPayload
  | OwnerReassignedPayload
  | ConflictResolvedPayload
  | PermissionChangedPayload
  | AuthorizationEvaluatedPayload
  | OperationExecutedPayload
  | ExecutionPreventedPayload

export type AuditEvent = EventBase & EventPayload
export type PermissionChangedEvent = EventBase & PermissionChangedPayload
export type AuthorizationEvaluatedEvent = EventBase & AuthorizationEvaluatedPayload

export interface Actor {
  name: string
  role: SimRole
}

export interface AppState {
  teams: Team[]
  workers: Worker[]
  missions: Mission[]
  values: ValueRecord[]
  operations: Operation[]
  conflicts: Conflict[]
  concerns: PerformanceConcern[]
  events: AuditEvent[]
  nextSeq: number
  /** Simulated clock (ISO). Never moves backwards. */
  clock: string
  /** The clock when the demo was seeded; events after it are the user's own actions. */
  seedClock: string
  actingAs: Actor
}
