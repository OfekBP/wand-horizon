import { describe, expect, it } from 'vitest'
import { authorize, permissionsAsOf, replayMatches } from '../src/domain/authorize'
import { applyAction, type Action } from '../src/domain/reducer'
import type { AppState, AuthorizationEvaluatedEvent, Operation, Worker } from '../src/domain/types'

const T0 = Date.parse('2026-01-01T00:00:00Z')
const at = (min: number) => new Date(T0 + min * 60_000).toISOString()

const worker = (id: string, kind: 'human' | 'ai'): Worker => ({
  id, kind, name: id, role: 'r', teamId: 't', status: 'active', ownerId: null, responsibilities: [], monthlyCost: 100,
})

const op = (over: Partial<Operation> = {}): Operation => ({
  id: 'op-1', title: 't', summary: 's', workerId: 'ai-1', decisionOwnerId: 'h-1', status: 'in_progress',
  severity: 'high', amount: 100_000, requiredScope: 'payments:wire:execute', startedAt: at(0), ...over,
})

const base = (): AppState => ({
  teams: [{ id: 't', name: 'T' }],
  workers: [worker('ai-1', 'ai'), worker('h-1', 'human'), worker('h-2', 'human')],
  values: [], operations: [], conflicts: [], concerns: [], events: [], nextSeq: 1, clock: at(0),
  actingAs: { name: 'Exec', role: 'executive' },
})

let t = 0
const meta = () => ({ at: at(++t), actor: 'tester' })
function run(state: AppState, ...actions: Action[]): AppState {
  let s = state
  for (const a of actions) {
    const r = applyAction(s, a)
    if (!r.ok) throw new Error(r.error)
    s = r.state
  }
  return s
}
const grant = (limit?: number): Action => ({ type: 'CHANGE_PERMISSION', ...meta(), workerId: 'ai-1', scope: 'payments:wire:execute', action: 'grant', limit, reason: 'r' })
const modify = (limit: number): Action => ({ type: 'CHANGE_PERMISSION', ...meta(), workerId: 'ai-1', scope: 'payments:wire:execute', action: 'modify', limit, reason: 'r' })
const revoke = (): Action => ({ type: 'CHANGE_PERMISSION', ...meta(), workerId: 'ai-1', scope: 'payments:wire:execute', action: 'revoke', reason: 'r' })
const start = (o: Operation = op()): Action => ({ type: 'START_OPERATION', ...meta(), operation: o })
const attempt = (id = 'op-1'): Action => ({ type: 'ATTEMPT_EXECUTION', ...meta(), operationId: id })

const lastEval = (s: AppState) => [...s.events].reverse().find((e): e is AuthorizationEvaluatedEvent => e.type === 'AuthorizationEvaluated')!
const status = (s: AppState, id = 'op-1') => s.operations.find((o) => o.id === id)!.status

describe('authorization at execution time', () => {
  it('allows execution under an active grant', () => {
    const s = run(base(), grant(500_000), start(), attempt())
    expect(status(s)).toBe('executed')
    expect(lastEval(s)).toMatchObject({ decision: 'allowed', reasonCode: 'ACTIVE_GRANT' })
  })

  it('prevents execution when the scope was never granted', () => {
    const s = run(base(), start(), attempt())
    expect(status(s)).toBe('prevented')
    expect(lastEval(s)).toMatchObject({ decision: 'denied', reasonCode: 'NO_GRANT', evidenceChangeIds: [] })
  })

  it('prevents execution when revoked mid-flight (after start, before execution)', () => {
    const s = run(base(), grant(500_000), start(), revoke(), attempt())
    expect(status(s)).toBe('prevented')
    expect(lastEval(s)).toMatchObject({ decision: 'denied', reasonCode: 'REVOKED' })
    expect(s.events.some((e) => e.type === 'ExecutionPrevented')).toBe(true)
  })

  it('prevents execution when the limit is lowered below the amount', () => {
    const s = run(base(), grant(500_000), start(), modify(50_000), attempt())
    expect(lastEval(s)).toMatchObject({ decision: 'denied', reasonCode: 'LIMIT_EXCEEDED', scopeState: { active: true, limit: 50_000 } })
  })

  it('allows execution again after revoke then re-grant, with the new limit only', () => {
    const s = run(base(), grant(10), revoke(), grant(500_000), start(), attempt())
    expect(lastEval(s)).toMatchObject({ decision: 'allowed', scopeState: { active: true, limit: 500_000 } })
    expect(lastEval(s).evidenceChangeIds).toHaveLength(3)
  })

  it('records evidence ids, cutoff and timestamp for every attempt', () => {
    const s = run(base(), grant(500_000), modify(400_000), start(), attempt())
    const e = lastEval(s)
    const changes = s.events.filter((x) => x.type === 'PermissionChanged')
    expect(e.evidenceChangeIds).toEqual(changes.map((c) => c.id))
    expect(e.cutoffSeq).toBe(e.seq - 1)
    expect(e.at).toBeTruthy()
    const outcome = s.events.find((x) => x.type === 'OperationExecuted')
    expect(outcome).toMatchObject({ evaluationEventId: e.id })
  })

  it('later permission changes never rewrite an earlier decision or outcome', () => {
    const executed = run(base(), grant(500_000), start(), attempt())
    const before = JSON.stringify(executed.events)
    const after = run(executed, revoke(), grant(1), modify(2))
    expect(JSON.stringify(after.events.slice(0, executed.events.length))).toBe(before)
    expect(status(after)).toBe('executed')
    expect(replayMatches(after.events, lastEval(after))).toBe(true)
    expect(lastEval(after).decision).toBe('allowed')
  })

  it('evaluates permission as of a cutoff seq (history reconstruction)', () => {
    const s = run(base(), grant(500_000), start(), revoke())
    const grantSeq = s.events.find((e) => e.type === 'PermissionChanged')!.seq
    expect(permissionsAsOf(s.events, 'ai-1', grantSeq)['payments:wire:execute']).toEqual({ active: true, limit: 500_000 })
    expect(permissionsAsOf(s.events, 'ai-1', grantSeq - 1)).toEqual({})
    expect(permissionsAsOf(s.events, 'ai-1', s.nextSeq)['payments:wire:execute']).toEqual({ active: false })
  })

  it('orders by seq even when timestamps tie', () => {
    let s = base()
    const same = at(5)
    const mk = (action: 'grant' | 'revoke'): Action => ({ type: 'CHANGE_PERMISSION', at: same, actor: 'x', workerId: 'ai-1', scope: 'payments:wire:execute', action, limit: action === 'grant' ? 5 : undefined, reason: 'r' })
    s = run(s, mk('grant'), mk('revoke'))
    expect(permissionsAsOf(s.events, 'ai-1', s.nextSeq)['payments:wire:execute'].active).toBe(false)
    expect(authorize(s.events, { workerId: 'ai-1', requiredScope: 'payments:wire:execute', amount: 1 }, s.nextSeq).reasonCode).toBe('REVOKED')
  })
})

describe('execution eligibility', () => {
  it('rejects an attempt on an awaiting_approval operation and records nothing', () => {
    const s = run(base(), grant(500_000), start(op({ status: 'awaiting_approval' })))
    const r = applyAction(s, attempt())
    expect(r.ok).toBe(false)
    expect(s.events.filter((e) => e.type === 'AuthorizationEvaluated')).toHaveLength(0)
  })

  it('rejects a second attempt once an outcome is final', () => {
    const s = run(base(), grant(500_000), start(), attempt())
    expect(applyAction(s, attempt()).ok).toBe(false)
  })
})

describe('permission guards', () => {
  it('rejects modify/revoke on an inactive scope and grant on an active one', () => {
    const s = base()
    expect(applyAction(s, modify(5)).ok).toBe(false)
    expect(applyAction(s, revoke()).ok).toBe(false)
    expect(applyAction(run(s, grant(5)), grant(6)).ok).toBe(false)
  })
})

describe('reassigning a pending decision (flow A)', () => {
  const awaiting = () => run(base(), start(op({ status: 'awaiting_approval', awaitingSince: at(0) })))
  it('changes the owner, keeps the status, and records exactly one OwnerReassigned event', () => {
    const s0 = awaiting()
    const s = run(s0, { type: 'REASSIGN_OWNER', ...meta(), operationId: 'op-1', newOwnerId: 'h-2', reason: 'Approver on leave' })
    const o = s.operations[0]
    expect(o.decisionOwnerId).toBe('h-2')
    expect(o.status).toBe('awaiting_approval')
    const evs = s.events.filter((e) => e.type === 'OwnerReassigned')
    expect(evs).toHaveLength(1)
    expect(evs[0]).toMatchObject({ fromOwnerId: 'h-1', toOwnerId: 'h-2', reason: 'Approver on leave' })
  })
  it('rejects same owner, AI target, empty reason, and non-awaiting operations', () => {
    const s = awaiting()
    const re = (newOwnerId: string, reason = 'r', operationId = 'op-1'): Action => ({ type: 'REASSIGN_OWNER', ...meta(), operationId, newOwnerId, reason })
    expect(applyAction(s, re('h-1')).ok).toBe(false)
    expect(applyAction(s, re('ai-1')).ok).toBe(false)
    expect(applyAction(s, re('h-2', '  ')).ok).toBe(false)
    const ip = run(base(), start())
    expect(applyAction(ip, re('h-2')).ok).toBe(false)
  })
})

describe('resolving a conflict (flow B)', () => {
  const withConflict = (): AppState => ({
    ...base(),
    workers: [...base().workers, worker('ai-2', 'ai')],
    conflicts: [{ id: 'c-1', workerAId: 'ai-1', workerBId: 'ai-2', resource: 'r', summary: 's', severity: 'high', detectedAt: at(0), status: 'open' }],
  })
  it('resolves once, records the authoritative worker, and leaves operation statuses alone', () => {
    const s0 = run(withConflict(), start())
    const s = run(s0, { type: 'RESOLVE_CONFLICT', ...meta(), conflictId: 'c-1', authoritativeWorkerId: 'ai-2', note: 'ai-2 owns it' })
    expect(s.conflicts[0]).toMatchObject({ status: 'resolved', resolution: { authoritativeWorkerId: 'ai-2', note: 'ai-2 owns it' } })
    expect(s.operations.map((o) => o.status)).toEqual(s0.operations.map((o) => o.status))
    expect(s.events.filter((e) => e.type === 'ConflictResolved')).toHaveLength(1)
    expect(applyAction(s, { type: 'RESOLVE_CONFLICT', ...meta(), conflictId: 'c-1', authoritativeWorkerId: 'ai-1', note: 'again' }).ok).toBe(false)
  })
  it('requires a note and one of the two workers', () => {
    const s = withConflict()
    expect(applyAction(s, { type: 'RESOLVE_CONFLICT', ...meta(), conflictId: 'c-1', authoritativeWorkerId: 'ai-1', note: ' ' }).ok).toBe(false)
    expect(applyAction(s, { type: 'RESOLVE_CONFLICT', ...meta(), conflictId: 'c-1', authoritativeWorkerId: 'h-1', note: 'x' }).ok).toBe(false)
  })
})

describe('event log integrity', () => {
  it('every action appends events with strictly increasing seq and never edits earlier ones', () => {
    let s = base()
    const snapshots: string[] = []
    for (const a of [grant(5), start(), modify(9), revoke(), attempt()]) {
      s = run(s, a)
      snapshots.push(JSON.stringify(s.events))
    }
    const seqs = s.events.map((e) => e.seq)
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b))
    expect(new Set(seqs).size).toBe(seqs.length)
    for (let i = 1; i < snapshots.length; i++) {
      const prev = JSON.parse(snapshots[i - 1]) as unknown[]
      expect(JSON.stringify(JSON.parse(snapshots[i]).slice(0, prev.length))).toBe(snapshots[i - 1])
    }
  })
  it('rejects a clock that moves backwards', () => {
    const s = run(base(), grant(5))
    expect(applyAction(s, { type: 'CHANGE_PERMISSION', at: at(-10), actor: 'x', workerId: 'ai-1', scope: 'payments:wire:execute', action: 'revoke', reason: 'r' }).ok).toBe(false)
  })
})
