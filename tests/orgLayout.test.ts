import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/data/generate'
import { boundsOf, layoutMap } from '../src/domain/orgLayout'

const state = createInitialState()
const layout = layoutMap(state.workers, state.teams)

describe('organization layout', () => {
  it('places every one of the 550 workers exactly once', () => {
    expect(layout.nodes.size).toBe(550)
    for (const w of state.workers) expect(layout.nodes.has(w.id)).toBe(true)
  })

  it('is deterministic', () => {
    const again = layoutMap(state.workers, state.teams)
    expect([...again.nodes.entries()]).toEqual([...layout.nodes.entries()])
  })

  it('keeps every node inside its team region and inside the canvas', () => {
    for (const n of layout.nodes.values()) {
      expect(n.x - n.r).toBeGreaterThanOrEqual(0)
      expect(n.x + n.r).toBeLessThanOrEqual(layout.width)
      expect(n.y - n.r).toBeGreaterThanOrEqual(0)
      expect(n.y + n.r).toBeLessThanOrEqual(layout.height)
      if (n.id === layout.execId) continue
      const region = layout.regions.get(n.teamId)!
      expect(n.x - n.r).toBeGreaterThanOrEqual(region.x)
      expect(n.x + n.r).toBeLessThanOrEqual(region.x + region.w)
      expect(n.y - n.r).toBeGreaterThanOrEqual(region.y)
      expect(n.y + n.r).toBeLessThanOrEqual(region.y + region.h)
    }
  })

  it('never overlaps two nodes', () => {
    const all = [...layout.nodes.values()]
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) {
        const d = Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y)
        expect(d).toBeGreaterThanOrEqual(all[i].r + all[j].r)
      }
  })

  it('draws every AI worker inside the pod of its accountable owner', () => {
    for (const w of state.workers.filter((x) => x.kind === 'ai')) {
      const pod = layout.pods.get(w.ownerId!)!
      const n = layout.nodes.get(w.id)!
      expect(n.x).toBeGreaterThanOrEqual(pod.x)
      expect(n.x).toBeLessThanOrEqual(pod.x + pod.w)
      expect(n.y).toBeGreaterThanOrEqual(pod.y)
      expect(n.y).toBeLessThanOrEqual(pod.y + pod.h)
    }
  })

  it('shows the hierarchy: the executive reaches every person through reporting lines', () => {
    const reach = new Set<string>([layout.execId])
    let grew = true
    while (grew) {
      grew = false
      for (const e of layout.edges) {
        if (reach.has(e.from) && !reach.has(e.to)) {
          reach.add(e.to)
          grew = true
        }
      }
    }
    const humans = state.workers.filter((w) => w.kind === 'human')
    expect(humans.every((h) => reach.has(h.id))).toBe(true)
  })

  it('computes a padded focus box for a set of nodes', () => {
    const b = boundsOf(layout, ['a-001', 'a-002'])!
    expect(b.w).toBeGreaterThan(0)
    expect(boundsOf(layout, ['nope'])).toBeNull()
  })
})
