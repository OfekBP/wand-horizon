import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/data/generate'
import { findings, missionMembers, suggestedDelegates } from '../src/domain/findings'
import { applyAction, type Action } from '../src/domain/reducer'
import { classifyAiWorkers, overviewMetrics } from '../src/domain/selectors'
import type { AppState } from '../src/domain/types'

const seed = createInitialState()
const worker = (name: string) => seed.workers.find((w) => w.name === name)!
let tick = 0
const meta = (s: AppState) => ({ at: new Date(Date.parse(s.clock) + 60_000 * ++tick).toISOString(), actor: 'tester' })
function run(state: AppState, build: (m: { at: string; actor: string }) => Action): AppState {
  const r = applyAction(state, build(meta(state)))
  if (!r.ok) throw new Error(r.error)
  return r.state
}
const reject = (state: AppState, build: (m: { at: string; actor: string }) => Action) => applyAction(state, build(meta(state)))
const ids = (s: AppState) => findings(s).map((f) => f.id)

describe('seeded findings', () => {
  const all = findings(seed)

  it('surfaces the five kinds of problem and ranks the blocked critical decision first', () => {
    expect(new Set(all.map((f) => f.kind))).toEqual(new Set(['blocked-decision', 'conflicting-objectives', 'duplicate-work', 'cost-without-proof', 'authority-at-risk']))
    expect(all[0].id).toBe('blocked:op-a1')
    expect(all[0].severity).toBe('critical')
  })

  it('only flags a blocked operation when its decision-maker is actually unavailable', () => {
    const blockedFindings = all.filter((f) => f.kind === 'blocked-decision')
    expect(blockedFindings.map((f) => f.id)).toEqual(['blocked:op-a1'])
    const owner = seed.workers.find((w) => w.id === seed.operations.find((o) => o.id === 'op-a1')!.decisionOwnerId)!
    expect(owner.availability?.status).toBe('out_of_office')
  })

  it('states the business consequence and the deadline for the blocked settlement', () => {
    const f = all.find((x) => x.id === 'blocked:op-a1')!
    const text = f.chain.map((c) => c.detail).join(' ')
    expect(text).toMatch(/Elena Park/)
    expect(text).toMatch(/out of office until Oct 31/)
    expect(text).toMatch(/in 20h/)
    expect(f.consequence).toMatch(/\$2,400,000/)
  })

  it('separates duplicated work from conflicting objectives, and links missions for the objective conflict', () => {
    const c1 = all.find((f) => f.id === 'conflict:c-001')!
    expect(c1.kind).toBe('conflicting-objectives')
    expect(c1.reach.missionIds.sort()).toEqual(['m-idle', 'm-pay'])
    expect(all.find((f) => f.id === 'conflict:c-003')!.kind).toBe('duplicate-work')
  })

  it('conflict workers really belong to the missions the finding names', () => {
    const c = seed.conflicts.find((x) => x.id === 'c-001')!
    expect(worker('Payments-Disburse-003').missionId).toBe(c.missionAId)
    expect(worker('Liquidity-Forecast-005').missionId).toBe(c.missionBId)
  })
})

describe('cost without verified value (simulated comparison)', () => {
  const f = findings(seed).find((x) => x.id === 'cost:m-claims')!

  it('flags only the mission whose workers rose in modeled cost and have no verified value', () => {
    expect(findings(seed).filter((x) => x.kind === 'cost-without-proof').map((x) => x.id)).toEqual(['cost:m-claims'])
    const classes = classifyAiWorkers(seed)
    expect(f.reach.workerIds).toHaveLength(14)
    expect(f.reach.workerIds.every((id) => classes.get(id) !== 'verified')).toBe(true)
  })

  it('does not flag a mission whose cost rose but is verified', () => {
    const pay = missionMembers(seed, 'm-pay')
    expect(pay.some((w) => w.monthlyCost > (w.priorMonthlyCost ?? 0) * 1.1)).toBe(true)
    expect(ids(seed)).not.toContain('cost:m-pay')
  })

  it('every figure in the finding equals the sums of the underlying modeled fields, and is labeled simulated', () => {
    const members = f.reach.workerIds.map((id) => seed.workers.find((w) => w.id === id)!)
    const now = Math.round(members.reduce((a, w) => a + w.monthlyCost, 0))
    const before = Math.round(members.reduce((a, w) => a + (w.priorMonthlyCost ?? 0), 0))
    const costLine = f.chain.find((c) => c.label === 'Cost')!.detail
    expect(costLine).toContain(`$${now.toLocaleString('en-US')}`)
    expect(costLine).toContain(`$${before.toLocaleString('en-US')}`)
    expect(costLine).toMatch(/modeled, not measured/)
    expect(f.consequence).toMatch(/simulated comparison/)
    expect(f.consequence).toContain(`$${(now - before).toLocaleString('en-US')}`)
  })

  it('every AI worker carries a prior-period cost from the same model', () => {
    const ai = seed.workers.filter((w) => w.kind === 'ai')
    expect(ai.every((w) => (w.priorMonthlyCost ?? 0) > 0)).toBe(true)
  })
})

describe('resolving an issue changes real state, and the finding disappears because of it', () => {
  it('reassigning the blocked decision to an available person clears the finding, keeps the operation awaiting approval, and logs one event', () => {
    const ingrid = worker('Ingrid Novak')
    const after = run(seed, (m) => ({ type: 'REASSIGN_OWNER', ...m, operationId: 'op-a1', newOwnerId: ingrid.id, reason: 'Elena is on leave' }))
    expect(ids(after)).not.toContain('blocked:op-a1')
    const op = after.operations.find((o) => o.id === 'op-a1')!
    expect(op.decisionOwnerId).toBe(ingrid.id)
    expect(op.status).toBe('awaiting_approval')
    expect(after.events.filter((e) => e.type === 'OwnerReassigned')).toHaveLength(seed.events.filter((e) => e.type === 'OwnerReassigned').length + 1)
  })

  it('refuses to hand the decision to someone who is also unavailable', () => {
    const away: AppState = {
      ...seed,
      workers: seed.workers.map((w) => (w.name === 'Ingrid Novak' ? { ...w, availability: { status: 'out_of_office' as const, until: '2026-11-02T00:00:00.000Z' } } : w)),
    }
    const r = reject(away, (m) => ({ type: 'REASSIGN_OWNER', ...m, operationId: 'op-a1', newOwnerId: worker('Ingrid Novak').id, reason: 'x' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/out of office until 2026-11-02/)
  })

  it('suggests only available people, never the current owner', () => {
    const op = seed.operations.find((o) => o.id === 'op-a1')!
    const s = suggestedDelegates(seed, op)
    expect(s.length).toBeGreaterThan(0)
    expect(s.every((h) => h.kind === 'human' && h.id !== op.decisionOwnerId && h.availability?.status !== 'out_of_office')).toBe(true)
  })

  it('resolving the conflict clears its finding', () => {
    const c = seed.conflicts.find((x) => x.id === 'c-001')!
    const after = run(seed, (m) => ({ type: 'RESOLVE_CONFLICT', ...m, conflictId: 'c-001', authoritativeWorkerId: c.workerBId, note: 'Liquidity owns the buffer' }))
    expect(ids(after)).not.toContain('conflict:c-001')
  })

  it('pausing the unproven workers clears the cost finding, lowers the run-rate, shrinks active coverage, and logs one event', () => {
    const f = findings(seed).find((x) => x.id === 'cost:m-claims')!
    const before = overviewMetrics(seed)
    const after = run(seed, (m) => ({ type: 'PAUSE_WORKERS', ...m, workerIds: f.reach.workerIds, reason: 'No verified value' }))
    expect(ids(after)).not.toContain('cost:m-claims')
    const saved = f.reach.workerIds.reduce((a, id) => a + seed.workers.find((w) => w.id === id)!.monthlyCost, 0)
    const m = overviewMetrics(after)
    expect(before.aiCost - m.aiCost).toBe(saved)
    expect(m.activeAi).toBe(before.activeAi - 14)
    expect(m.aiWorkers).toBe(before.aiWorkers)
    const ev = after.events.filter((e) => e.type === 'WorkersPaused')
    expect(ev).toHaveLength(1)
    expect(ev[0]).toMatchObject({ workerIds: f.reach.workerIds })
  })

  it('a paused worker cannot execute, and nothing is recorded for the refused attempt', () => {
    const w = worker('Payments-Disburse-003')
    const paused = run(seed, (m) => ({ type: 'PAUSE_WORKERS', ...m, workerIds: [w.id], reason: 'Investigating errors' }))
    const r = reject(paused, (m) => ({ type: 'ATTEMPT_EXECUTION', ...m, operationId: 'op-c1' }))
    expect(r.ok).toBe(false)
    expect(paused.events.filter((e) => e.type === 'AuthorizationEvaluated').length).toBe(seed.events.filter((e) => e.type === 'AuthorizationEvaluated').length)
  })

  it('pause guards: needs a reason, AI workers only, each must be active', () => {
    const w = worker('Payments-Disburse-003')
    expect(reject(seed, (m) => ({ type: 'PAUSE_WORKERS', ...m, workerIds: [w.id], reason: ' ' })).ok).toBe(false)
    expect(reject(seed, (m) => ({ type: 'PAUSE_WORKERS', ...m, workerIds: [worker('Priya Raman').id], reason: 'x' })).ok).toBe(false)
    const once = run(seed, (m) => ({ type: 'PAUSE_WORKERS', ...m, workerIds: [w.id], reason: 'x' }))
    expect(reject(once, (m) => ({ type: 'PAUSE_WORKERS', ...m, workerIds: [w.id], reason: 'again' })).ok).toBe(false)
  })

  it('restoring authority clears the authority-at-risk finding', () => {
    const r1 = seed.workers.find((w) => w.name === 'Ledger-Adjust-002')!
    expect(ids(seed)).toContain('risk:op-r1')
    const after = run(seed, (m) => ({ type: 'CHANGE_PERMISSION', ...m, workerId: r1.id, scope: 'ledger:adjust', action: 'modify', limit: 250_000, reason: 'Audit review closed' }))
    expect(ids(after)).not.toContain('risk:op-r1')
  })
})
