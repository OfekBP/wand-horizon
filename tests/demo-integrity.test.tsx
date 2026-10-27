import { act, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../src/App'
import { SCENES, type Ctx } from '../src/ui/demo/script'

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Runs the real demo script against the real application in jsdom, with no waiting and no cursor.
 * Every element a scene looks for must exist, so a rename or a layout change that would break the
 * product demo fails here instead of silently in the browser.
 */
function makeCtx(misses: string[], captions: string[], scene: string): Ctx {
  const tick = (ms = 0) => act(async () => void (await sleep(ms)))
  const setNativeValue = (el: HTMLElement, value: string) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  const ctx: Ctx = {
    wait: () => tick(),
    go: (hash) => {
      window.location.hash = hash
    },
    hash: () => window.location.hash,
    find: async (look, timeoutMs = 3500) => {
      const end = Date.now() + Math.min(timeoutMs, 4000)
      do {
        const found = look(document)
        if (found) return found
        await tick(25)
      } while (Date.now() < end)
      misses.push(`${scene}: ${look.toString().slice(0, 90)}`)
      return null
    },
    point: async () => {
      await tick()
    },
    click: async (el) => {
      if (!el) return
      await act(async () => {
        el.click()
      })
      await tick()
    },
    type: async (el, text) => {
      if (!el) return
      await act(async () => setNativeValue(el, text))
    },
    caption: (c) => {
      if (c) captions.push(c.title)
    },
    card: () => {},
    showCursor: () => {},
  }
  return ctx
}

describe('the product demo still matches the real application', () => {
  it('finds and clicks every element each scene needs, and the story really happens', async () => {
    window.location.hash = '#/overview'
    render(<App />)
    const misses: string[] = []
    const captions: string[] = []
    for (const scene of SCENES) await scene.run(makeCtx(misses, captions, scene.id))
    expect(misses).toEqual([])
    expect(captions.length).toBeGreaterThan(8)
    // the narrative's real effects: the decision moved, the unproven workers paused, the wire step prevented
    expect(document.body.textContent).toMatch(/Incident replay/)
  }, 90_000)
})
