import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/data/generate'
import { applyAction, type Action } from '../src/domain/reducer'
import { authorityAtRisk, caseRows, governanceStats, inSegment, thenVsNow } from '../src/domain/selectors'
import type { AppState, AuthorizationEvaluatedEvent } from '../src/domain/types'

const seed = createInitialState()
const worker = (name: string) => seed.workers.find((w) => w.name === name)!
let tick = 0
const meta = (s: AppState) => ({ at: new Date(Date.parse(s.clock) + 60_000 * ++tick).toISOString(), actor: 'tester' })

function run(state: AppState, build: (m: { at: string; actor: string }) => Action): AppState {
  const r = applyAction(state, build(meta(state)))
  if (!r.ok) throw new Error(r.error)
  return r.state
}
const revoke = (s: AppState, name: string, scope: string) =>
  run(s, (m) => ({ type: 'CHANGE_PERMISSION', ...m, workerId: worker(name).id, scope, action: 'revoke', reason: 'test' }))
const evalFor = (s: AppState, opId: string) =>
  s.events.find((e): e is AuthorizationEvaluatedEvent => e.type === 'AuthorizationEvaluated' && e.operationId === opId)!

describe('authority at risk (derived, never stored)', () => {
  it('seeds exactly one in-flight operation that would be denied now', () => {
    const risk = authorityAtRisk(seed)
    expect(risk.map((r) => r.op.id)).toEqual(['op-r1'])
    expect(risk[0].liveDecision).toMatchObject({ decision: 'denied', reasonCode: 'LIMIT_EXCEEDED' })
    expect(risk[0].op.status).toBe('in_progress')
  })

  it('moves when a permission is revoked mid-flight and ignores operations that are not in progress', () => {
    const after = revoke(seed, 'Payments-Disburse-003', 'payments:wire:execute')
    const ids = authorityAtRisk(after).map((r) => r.op.id)
    expect(ids).toContain('op-c1')
    expect(authorityAtRisk(after)).toHaveLength(2)
    expect(authorityAtRisk(after).every((r) => r.op.status === 'in_progress')).toBe(true)
  })

  it('clears once the operation reaches a final outcome', () => {
    const revoked = revoke(seed, 'Payments-Disburse-003', 'payments:wire:execute')
    const ran = run(revoked, (m) => ({ type: 'ATTEMPT_EXECUTION', ...m, operationId: 'op-c1' }))
    expect(authorityAtRisk(ran).map((r) => r.op.id)).not.toContain('op-c1')
  })
})

describe('then versus now', () => {
  it('keeps an executed decision as allowed even though today it would be denied', () => {
    const e = evalFor(seed, 'op-d2')
    const t = thenVsNow(seed, e)
    expect(t.stored.decision).toBe('allowed')
    expect(t.today).toMatchObject({ decision: 'denied', reasonCode: 'REVOKED' })
    expect(t.changedSince).toHaveLength(1)
    expect(t.changedSince[0].action).toBe('revoke')
  })

  it('reports no change when nothing was recorded after the decision', () => {
    const plain = caseRows(seed).find((r) => r.op.status === 'executed' && r.changedDuringCase.length === 0 && r.evaluation)!
    const t = thenVsNow(seed, plain.evaluation!)
    expect(t.changedSince).toHaveLength(0)
    expect(t.today.decision).toBe(plain.evaluation!.decision)
  })

  it('a later change never rewrites the stored decision', () => {
    const e = evalFor(seed, 'op-d3')
    const after = revoke(seed, 'Claims-Payout-005', 'claims:payout:approve')
    const same = evalFor(after, 'op-d3')
    expect(same).toEqual(e)
    expect(thenVsNow(after, same).changedSince).toHaveLength(1)
  })
})

describe('case rows and segments', () => {
  const rows = caseRows(seed)
  it('has one row per operation and segments partition by status', () => {
    expect(rows).toHaveLength(seed.operations.length)
    const open = rows.filter((r) => inSegment(r, 'open')).length
    const executed = rows.filter((r) => inSegment(r, 'executed')).length
    const prevented = rows.filter((r) => inSegment(r, 'prevented')).length
    expect(open + executed + prevented).toBe(rows.length)
  })
  it('flags operations whose authority changed during the case', () => {
    const changed = rows.filter((r) => inSegment(r, 'changed')).map((r) => r.op.id)
    expect(changed).toEqual(expect.arrayContaining(['op-d1', 'op-d2', 'op-r1']))
  })
})

describe('governance stats', () => {
  it('counts decisions from the log and every one replays', () => {
    const all = governanceStats(seed, '2000-01-01T00:00:00Z')
    const logged = seed.events.filter((e) => e.type === 'AuthorizationEvaluated').length
    expect(all.attempts).toBe(logged)
    expect(all.allowed + all.denied).toBe(all.attempts)
    expect(Object.values(all.deniedByReason).reduce((a, b) => a + b, 0)).toBe(all.denied)
    expect(all.replayVerified).toBe(all.attempts)
  })
})
