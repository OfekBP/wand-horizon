import { appendEvent } from './audit'
import { authorize } from './authorize'
import type { Actor, AppState, Operation, PermissionAction } from './types'

/** Scopes the prototype knows about. Matching is exact-string; there are no wildcards. */
export const SCOPES: Record<string, string> = {
  'payments:wire:execute': 'Execute outbound wires',
  'settlement:release': 'Release settlement batches',
  'claims:payout:approve': 'Approve claim payouts',
  'ledger:adjust': 'Post ledger adjustments',
  'refund:issue': 'Issue customer refunds',
  'reserve:adjust': 'Adjust loss reserves',
  'policy:bind': 'Bind insurance policies',
  'sanctions:hold:release': 'Release sanctions holds',
}

interface Meta {
  at: string
  actor: string
}

export type Action =
  | ({ type: 'START_OPERATION'; operation: Operation } & Meta)
  | ({
      type: 'CHANGE_PERMISSION'
      workerId: string
      scope: string
      action: PermissionAction
      limit?: number
      reason: string
    } & Meta)
  | ({ type: 'ATTEMPT_EXECUTION'; operationId: string } & Meta)
  | ({ type: 'REASSIGN_OWNER'; operationId: string; newOwnerId: string; reason: string } & Meta)
  | ({ type: 'RESOLVE_CONFLICT'; conflictId: string; authoritativeWorkerId: string; note: string } & Meta)
  | ({ type: 'PAUSE_WORKERS'; workerIds: string[]; reason: string } & Meta)

export type UserAction = Action extends infer A ? (A extends Action ? Omit<A, 'at' | 'actor'> : never) : never

export type Result = { ok: true; state: AppState } | { ok: false; error: string }

const fail = (error: string): Result => ({ ok: false, error })

const append = appendEvent

export function applyAction(state: AppState, action: Action): Result {
  if (Date.parse(action.at) < Date.parse(state.clock)) return fail('Clock cannot move backwards.')
  const meta: Meta = { at: action.at, actor: action.actor }

  switch (action.type) {
    case 'START_OPERATION': {
      const op = action.operation
      if (state.operations.some((o) => o.id === op.id)) return fail('Operation already exists.')
      if (op.status !== 'in_progress' && op.status !== 'awaiting_approval')
        return fail('An operation can only start as in_progress or awaiting_approval.')
      const { state: next } = append(
        { ...state, operations: [...state.operations, op] },
        meta,
        { operationId: op.id, workerId: op.workerId },
        { type: 'OperationStarted', initialStatus: op.status, ownerId: op.decisionOwnerId },
      )
      return { ok: true, state: next }
    }

    case 'CHANGE_PERMISSION': {
      const worker = state.workers.find((w) => w.id === action.workerId)
      if (!worker || worker.kind !== 'ai') return fail('Permissions apply to AI workers only.')
      if (!(action.scope in SCOPES)) return fail('Unknown scope.')
      if (!action.reason.trim()) return fail('A reason is required.')
      if (action.limit !== undefined && !(action.limit > 0)) return fail('Limit must be a positive amount.')
      const current = currentScope(state, action.workerId, action.scope)
      if (action.action === 'grant' && current.active) return fail('Scope is already granted. Modify its limit instead.')
      if (action.action === 'modify' && !current.active) return fail('Scope is not active. Grant it first.')
      if (action.action === 'modify' && action.limit === undefined) return fail('Modify requires a limit.')
      if (action.action === 'revoke' && !current.active) return fail('Scope is not active.')
      const { state: next } = append(
        state,
        meta,
        { workerId: action.workerId },
        {
          type: 'PermissionChanged',
          scope: action.scope,
          action: action.action,
          limit: action.action === 'revoke' ? undefined : action.limit,
          reason: action.reason.trim(),
        },
      )
      return { ok: true, state: next }
    }

    case 'ATTEMPT_EXECUTION': {
      const op = state.operations.find((o) => o.id === action.operationId)
      if (!op) return fail('Unknown operation.')
      if (op.status === 'awaiting_approval')
        return fail('This operation is awaiting a human decision and cannot be executed. Only in_progress operations can run.')
      if (op.status !== 'in_progress') return fail('This operation has already reached a final outcome.')
      if (state.workers.find((w) => w.id === op.workerId)?.status === 'paused') return fail('The executing worker is paused, so this operation cannot run.')

      // Authorization is evaluated at execution time against everything logged before this moment.
      const cutoffSeq = state.nextSeq - 1
      const result = authorize(state.events, { workerId: op.workerId, requiredScope: op.requiredScope, amount: op.amount }, cutoffSeq)
      const fields = { operationId: op.id, workerId: op.workerId }
      const evaluated = append(state, meta, fields, {
        type: 'AuthorizationEvaluated',
        requiredScope: op.requiredScope,
        amount: op.amount,
        decision: result.decision,
        reasonCode: result.reasonCode,
        cutoffSeq,
        scopeState: result.scopeState,
        evidenceChangeIds: result.evidenceChangeIds,
      })
      const allowed = result.decision === 'allowed'
      const outcome = append(
        evaluated.state,
        meta,
        fields,
        allowed
          ? { type: 'OperationExecuted', evaluationEventId: evaluated.event.id }
          : { type: 'ExecutionPrevented', evaluationEventId: evaluated.event.id, reasonCode: result.reasonCode },
      )
      const status = allowed ? 'executed' : 'prevented'
      return {
        ok: true,
        state: {
          ...outcome.state,
          operations: outcome.state.operations.map((o) => (o.id === op.id ? { ...o, status } : o)),
        },
      }
    }

    case 'REASSIGN_OWNER': {
      const op = state.operations.find((o) => o.id === action.operationId)
      if (!op) return fail('Unknown operation.')
      if (op.status !== 'awaiting_approval') return fail('Only operations awaiting approval can be reassigned.')
      const newOwner = state.workers.find((w) => w.id === action.newOwnerId)
      if (!newOwner || newOwner.kind !== 'human') return fail('The new decision owner must be a human.')
      if (newOwner.id === op.decisionOwnerId) return fail('Choose a different owner.')
      if (newOwner.availability?.status === 'out_of_office')
        return fail(`${newOwner.name} is out of office${newOwner.availability.until ? ` until ${newOwner.availability.until.slice(0, 10)}` : ''}. Choose someone who can take the decision.`)
      if (!action.reason.trim()) return fail('A reason is required.')
      const { state: next } = append(
        state,
        meta,
        { operationId: op.id, workerId: op.workerId },
        { type: 'OwnerReassigned', fromOwnerId: op.decisionOwnerId, toOwnerId: newOwner.id, reason: action.reason.trim() },
      )
      return {
        ok: true,
        state: {
          ...next,
          // status deliberately unchanged: still awaiting_approval
          operations: next.operations.map((o) => (o.id === op.id ? { ...o, decisionOwnerId: newOwner.id } : o)),
        },
      }
    }

    case 'PAUSE_WORKERS':
      return pauseWorkers(state, action, meta)

    case 'RESOLVE_CONFLICT': {
      const conflict = state.conflicts.find((c) => c.id === action.conflictId)
      if (!conflict) return fail('Unknown conflict.')
      if (conflict.status !== 'open') return fail('This conflict is already resolved.')
      if (action.authoritativeWorkerId !== conflict.workerAId && action.authoritativeWorkerId !== conflict.workerBId)
        return fail('The authoritative worker must be one of the two conflicting workers.')
      if (!action.note.trim()) return fail('A resolution note is required.')
      const { state: next } = append(
        state,
        meta,
        { workerId: action.authoritativeWorkerId },
        {
          type: 'ConflictResolved',
          conflictId: conflict.id,
          authoritativeWorkerId: action.authoritativeWorkerId,
          note: action.note.trim(),
        },
      )
      return {
        ok: true,
        state: {
          ...next,
          conflicts: next.conflicts.map((c) =>
            c.id === conflict.id
              ? {
                  ...c,
                  status: 'resolved',
                  resolution: {
                    authoritativeWorkerId: action.authoritativeWorkerId,
                    note: action.note.trim(),
                    resolvedBy: action.actor,
                    resolvedAt: action.at,
                  },
                }
              : c,
          ),
        },
      }
    }

  }
}

/** Pausing is a leadership control: it stops spend on workers and is recorded as one audit event. */
function pauseWorkers(state: AppState, action: Extract<Action, { type: 'PAUSE_WORKERS' }>, meta: Meta): Result {
  const ids = [...new Set(action.workerIds)]
  if (ids.length === 0) return fail('Choose at least one worker to pause.')
  if (!action.reason.trim()) return fail('A reason is required.')
  const targets = ids.map((id) => state.workers.find((w) => w.id === id))
  if (targets.some((w) => !w || w.kind !== 'ai')) return fail('Only AI workers can be paused.')
  if (targets.some((w) => w!.status !== 'active')) return fail('Every worker must be active to be paused.')
  const { state: next } = appendEvent(state, meta, {}, { type: 'WorkersPaused', workerIds: ids, reason: action.reason.trim() })
  return { ok: true, state: { ...next, workers: next.workers.map((w) => (ids.includes(w.id) ? { ...w, status: 'paused' as const } : w)) } }
}

function currentScope(state: AppState, workerId: string, scope: string) {
  // Same fold as authorize(), evaluated at the latest seq.
  return authorize(state.events, { workerId, requiredScope: scope, amount: 0 }, state.nextSeq - 1).scopeState
}

export function withActor(state: AppState, actor: Actor): AppState {
  return { ...state, actingAs: actor }
}
