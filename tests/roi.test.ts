import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/data/generate'
import { applyAction } from '../src/domain/reducer'
import { buildRoi, companyReturn, groupReturn, missionReturn, ownerReturn, reviewList, ROI_POLICY, statusForMultiple, teamReturn, verdict } from '../src/domain/roi'
import { overviewMetrics } from '../src/domain/selectors'
import type { AppState, Worker } from '../src/domain/types'

const seed = createInitialState()
const model = buildRoi(seed)
const ai = seed.workers.filter((w) => w.kind === 'ai')

describe('return on cost: the rule', () => {
  it('turns a verified multiple into a colour at the policy thresholds', () => {
    expect(statusForMultiple(ROI_POLICY.greenAt)).toBe('green')
    expect(statusForMultiple(ROI_POLICY.greenAt - 0.01)).toBe('amber')
    expect(statusForMultiple(ROI_POLICY.redBelow)).toBe('amber')
    expect(statusForMultiple(ROI_POLICY.redBelow - 0.01)).toBe('red')
  })

  it('is verified value over modeled cost, and estimated value never enters it', () => {
    for (const w of ai) {
      const r = model.byWorker.get(w.id)!
      const verified = seed.values.filter((v) => v.workerId === w.id && v.basis === 'verified').reduce((a, v) => a + v.amount, 0)
      const estimated = seed.values.filter((v) => v.workerId === w.id && v.basis === 'estimated').reduce((a, v) => a + v.amount, 0)
      expect(r.verified).toBe(verified)
      expect(r.estimated).toBe(estimated)
      expect(r.multiple).toBe(verified > 0 ? verified / w.monthlyCost : null)
    }
  })

  it('colours unproven spend: estimated only is amber, no data is grey, and rising cost with no proof is red', () => {
    for (const w of ai) {
      const r = model.byWorker.get(w.id)!
      if (r.verified > 0) continue
      if (r.costRising) expect(r.status).toBe('red')
      else expect(r.status).toBe(r.valueClass === 'estimatedOnly' ? 'amber' : 'grey')
    }
  })

  it('has people in every colour in the seeded portfolio', () => {
    const counts = groupReturn(model, ai).counts
    for (const c of ['green', 'amber', 'red', 'grey'] as const) expect(counts[c]).toBeGreaterThan(0)
    expect(counts.green + counts.amber + counts.red + counts.grey).toBe(500)
  })

  it('keeps the value classes the story depends on', () => {
    const classes = ai.reduce<Record<string, number>>((a, w) => ((a[model.byWorker.get(w.id)!.valueClass] = (a[model.byWorker.get(w.id)!.valueClass] ?? 0) + 1), a), {})
    expect(classes).toEqual({ verified: 290, estimatedOnly: 140, unmeasured: 70 })
  })
})

describe('return on cost: roll-ups', () => {
  it('the company return is verified value over active AI cost, matching the overview totals', () => {
    const c = companyReturn(seed, model)
    const m = overviewMetrics(seed)
    expect(c.verified).toBe(m.verifiedValue)
    expect(c.cost).toBe(m.aiCost)
    expect(c.multiple).toBeCloseTo(m.verifiedValue / m.aiCost, 10)
  })

  it('teams, missions and owners sum to their members', () => {
    for (const t of seed.teams) {
      const members = ai.filter((w) => w.teamId === t.id)
      const r = teamReturn(seed, model, t.id)
      expect(r.cost).toBe(members.reduce((a, w) => a + w.monthlyCost, 0))
      expect(r.workers).toBe(members.length)
    }
    for (const m of seed.missions) {
      const r = missionReturn(seed, model, m.id)
      expect(r.workers).toBe(ai.filter((w) => w.missionId === m.id).length)
    }
    const owner = seed.workers.find((w) => w.id === ai[0].ownerId)!
    const mine = ai.filter((w) => w.ownerId === owner.id)
    const r = ownerReturn(seed, model, owner.id)
    expect(r.workers).toBe(mine.length)
    expect(r.verified).toBe(mine.reduce((a, w) => a + model.byWorker.get(w.id)!.verified, 0))
  })

  it('a single worker with no verified value keeps its own colour', () => {
    for (const w of ai) {
      const r = model.byWorker.get(w.id)!
      expect(groupReturn(model, [w]).status).toBe(r.status)
    }
  })

  it('people have no return of their own', () => {
    for (const w of seed.workers.filter((x) => x.kind === 'human')) expect(model.byWorker.has(w.id)).toBe(false)
  })

  it('the Q4 claims mission is red: nothing verified and the cost is rising', () => {
    const r = missionReturn(seed, model, 'm-claims')
    expect(r.verified).toBe(0)
    expect(r.counts.red).toBeGreaterThan(0)
    expect(r.status).toBe('red')
  })

  it('the review list is red then amber, biggest spend first', () => {
    const list = reviewList(seed, model)
    expect(list.length).toBeGreaterThan(0)
    const rank = (w: Worker) => (model.byWorker.get(w.id)!.status === 'red' ? 0 : 1)
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1]
      const b = list[i]
      expect(rank(a) <= rank(b)).toBe(true)
      if (rank(a) === rank(b)) expect(a.monthlyCost).toBeGreaterThanOrEqual(b.monthlyCost)
    }
  })
})

describe('return on cost after a decision', () => {
  it('pausing the workers that are not paying off raises the company return and lowers spend, with one audit event', () => {
    const red = reviewList(seed, model, ['red'])
    const before = companyReturn(seed, model)
    const r = applyAction(seed, {
      type: 'PAUSE_WORKERS',
      workerIds: red.map((w) => w.id),
      reason: 'Return below target',
      at: new Date(Date.parse(seed.clock) + 120_000).toISOString(),
      actor: 'tester',
    })
    if (!r.ok) throw new Error(r.error)
    const next: AppState = r.state
    const after = companyReturn(next, buildRoi(next))
    expect(after.cost).toBeLessThan(before.cost)
    expect(after.multiple!).toBeGreaterThan(before.multiple!)
    expect(after.counts.red).toBe(0)
    expect(next.events.length).toBe(seed.events.length + 1)
  })

  it('reads as a plain sentence', () => {
    const green = [...model.byWorker.values()].find((r) => r.status === 'green')!
    expect(verdict(green, 'the settlement report')).toMatch(/Pays for itself/)
    const grey = [...model.byWorker.values()].find((r) => r.status === 'grey')!
    expect(verdict(grey)).toMatch(/missing evidence, not a verdict/)
  })
})
