import type { AppState, AuditEvent, EventPayload, ReasonCode } from './types'

/**
 * Audit event creation and rendering.
 *
 * appendEvent is the ONLY place events are built: it assigns the global seq and the id,
 * stamps the actor and time, and moves the simulated clock. Events are never edited or deleted.
 */
export interface EventMeta {
  at: string
  actor: string
}

export function appendEvent(
  state: AppState,
  meta: EventMeta,
  fields: { operationId?: string; workerId?: string },
  payload: EventPayload,
): { state: AppState; event: AuditEvent } {
  const seq = state.nextSeq
  const event = { id: `ev-${seq}`, seq, at: meta.at, actor: meta.actor, ...fields, ...payload } as AuditEvent
  return { event, state: { ...state, events: [...state.events, event], nextSeq: seq + 1, clock: meta.at } }
}

export const REASON_LABEL: Record<ReasonCode, string> = {
  ACTIVE_GRANT: 'An active grant covers this action',
  NO_GRANT: 'The worker was never granted this scope',
  REVOKED: 'The permission had been revoked',
  LIMIT_EXCEEDED: 'The amount exceeds the permitted limit',
}

export type EventTone = 'neutral' | 'accent' | 'ok' | 'critical'

export interface EventView {
  title: string
  tone: EventTone
  lines: string[]
}

const usd = (n: number) => `$${n.toLocaleString('en-US')}`
/** Event ids are `ev-<seq>`; people read them as #<seq>. */
const ref = (id: string) => `#${id.replace('ev-', '')}`

/** Plain-language rendering of an event. `nameOf` resolves worker ids. */
export function describeEvent(e: AuditEvent, nameOf: (id: string) => string): EventView {
  switch (e.type) {
    case 'OperationStarted':
      return {
        title: e.initialStatus === 'awaiting_approval' ? 'Operation started, awaiting approval' : 'Operation started',
        tone: 'neutral',
        lines: [`Executor: ${nameOf(e.workerId ?? '')}`, `Decision owner: ${nameOf(e.ownerId)}`],
      }
    case 'OwnerReassigned':
      return {
        title: 'Pending decision reassigned',
        tone: 'accent',
        lines: [`${nameOf(e.fromOwnerId)} → ${nameOf(e.toOwnerId)}`, `Reason: ${e.reason}`, 'Status unchanged: still awaiting approval'],
      }
    case 'ConflictResolved':
      return {
        title: 'Conflict resolved',
        tone: 'accent',
        lines: [`Authoritative worker: ${nameOf(e.authoritativeWorkerId)}`, `Note: ${e.note}`],
      }
    case 'PermissionChanged': {
      const title = e.action === 'grant' ? 'Permission granted' : e.action === 'modify' ? 'Permission limit modified' : 'Permission revoked'
      return {
        title,
        tone: e.action === 'revoke' ? 'critical' : 'neutral',
        lines: [
          `${nameOf(e.workerId ?? '')} · ${e.scope}${e.action === 'revoke' ? '' : e.limit !== undefined ? ` · limit ${usd(e.limit)}` : ' · no limit'}`,
          `Reason: ${e.reason}`,
        ],
      }
    }
    case 'AuthorizationEvaluated':
      return {
        title: e.decision === 'allowed' ? 'Authorization allowed' : 'Authorization denied',
        tone: e.decision === 'allowed' ? 'ok' : 'critical',
        lines: [
          `${e.requiredScope} for ${usd(e.amount)}`,
          REASON_LABEL[e.reasonCode],
          `Evaluated against permission events up to #${e.cutoffSeq}`,
        ],
      }
    case 'OperationExecuted':
      return { title: 'Operation executed', tone: 'ok', lines: [`Authorized by decision ${ref(e.evaluationEventId)}`] }
    case 'ExecutionPrevented':
      return { title: 'Execution prevented', tone: 'critical', lines: [REASON_LABEL[e.reasonCode], `Decision recorded in ${ref(e.evaluationEventId)}`] }
  }
}
