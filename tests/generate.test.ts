import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/data/generate'
import { replayMatches } from '../src/domain/authorize'
import { overviewMetrics, classifyAiWorkers } from '../src/domain/selectors'
import type { AuthorizationEvaluatedEvent } from '../src/domain/types'

describe('synthetic fixtures', () => {
  const state = createInitialState()

  it('is deterministic', () => {
    expect(createInitialState()).toEqual(state)
  })

  it('has 50 humans and 500 AI workers, every AI worker owned by an existing human', () => {
    const humans = state.workers.filter((w) => w.kind === 'human')
    const ai = state.workers.filter((w) => w.kind === 'ai')
    expect(humans).toHaveLength(50)
    expect(ai).toHaveLength(500)
    const humanIds = new Set(humans.map((h) => h.id))
    expect(ai.every((w) => w.ownerId !== null && humanIds.has(w.ownerId))).toBe(true)
    expect(new Set(state.workers.map((w) => w.id)).size).toBe(550)
  })

  it('partitions every active AI worker into exactly one value class (counts sum to 500)', () => {
    const m = overviewMetrics(state)
    expect(m.activeAi).toBe(500)
    expect(m.verifiedWorkers + m.estimatedOnlyWorkers + m.unmeasuredWorkers).toBe(500)
    expect(m.coverage).toBeCloseTo(m.verifiedWorkers / 500)
    expect(classifyAiWorkers(state).size).toBe(500)
  })

  it('assigns strictly increasing, unique seq numbers', () => {
    const seqs = state.events.map((e) => e.seq)
    expect(seqs.every((s, i) => i === 0 || s === seqs[i - 1] + 1)).toBe(true)
    expect(state.nextSeq).toBe(seqs[seqs.length - 1] + 1)
  })

  it('every recorded authorization decision replays identically from the log', () => {
    const evals = state.events.filter((e): e is AuthorizationEvaluatedEvent => e.type === 'AuthorizationEvaluated')
    expect(evals.length).toBeGreaterThan(30)
    expect(evals.every((e) => replayMatches(state.events, e))).toBe(true)
  })

  it('operation statuses agree with their recorded outcomes', () => {
    for (const op of state.operations) {
      const outcome = state.events.find((e) => e.operationId === op.id && (e.type === 'OperationExecuted' || e.type === 'ExecutionPrevented'))
      if (op.status === 'executed') expect(outcome?.type).toBe('OperationExecuted')
      else if (op.status === 'prevented') expect(outcome?.type).toBe('ExecutionPrevented')
      else expect(outcome).toBeUndefined()
    }
  })
})
