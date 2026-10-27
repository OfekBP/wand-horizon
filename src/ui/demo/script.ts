/**
 * The demo script. It is a deterministic walkthrough of the real application: each scene navigates the embedded
 * System (an iframe of this same app, on its own fresh in-memory state), moves a cursor to real elements and clicks
 * them, so every number, finding and audit event on screen comes from the actual product.
 * Nothing here is a mock-up; if an element is not found the scene simply carries on.
 */

import { FINDING_LABEL } from '../../domain/findings'
import { TERMS } from '../terms'

export interface Caption {
  step: string
  title: string
  body: string
}

export interface CardText {
  eyebrow?: string
  title: string
  body?: string
  action?: boolean
}

/** What a scene is allowed to do. Implemented by the player. */
export interface Ctx {
  /** Resolves after `ms` of playing time. Pausing stops the clock; seeking cancels the scene. */
  wait: (ms: number) => Promise<void>
  go: (hash: string) => void
  /** The embedded System's current hash. */
  hash: () => string
  find: <T extends HTMLElement>(look: (d: Document) => T | null | undefined, timeoutMs?: number) => Promise<T | null>
  point: (el: HTMLElement | null, fx?: number, fy?: number) => Promise<void>
  click: (el: HTMLElement | null) => Promise<void>
  /** Types into a field one character at a time, as a person would. */
  type: (el: HTMLElement | null, text: string) => Promise<void>
  caption: (c: Caption | null) => void
  card: (c: CardText | null) => void
  showCursor: (visible: boolean) => void
}

export interface Scene {
  id: string
  label: string
  summary: string
  /** Nominal length in seconds; the scene is padded to it so the timeline is stable. */
  seconds: number
  run: (ctx: Ctx) => Promise<void>
}

const exact = (text: string) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)

/** Matches an element by its own visible text. */
function byText(d: Document, selector: string, re: RegExp): HTMLElement | null {
  const all = Array.from(d.querySelectorAll<HTMLElement>(selector))
  return all.find((e) => re.test((e.textContent ?? '').trim())) ?? null
}

const finding = (prefix: string) => (d: Document) => d.querySelector<HTMLElement>(`button.finding[aria-label^="${prefix}"]`)
const heading = (re: RegExp) => (d: Document) => byText(d, 'h1, h2, h3, h4, .card__title, .section-label', re)

export const SCENES: Scene[] = [
  {
    id: 'problem',
    label: 'The problem',
    summary: 'A company of 50 people and 500 AI workers cannot see itself or prove what its AI was allowed to do.',
    seconds: 7,
    async run(c) {
      c.go('#/overview')
      c.showCursor(false)
      c.card({
        eyebrow: 'Wand Horizon',
        title: '50 people. 500 AI workers.',
        body: 'Who owns what? What is stuck? And when an AI worker acts, who can prove it was allowed to?',
      })
      await c.wait(3800)
      c.card({
        eyebrow: 'In this demo',
        title: 'See it. Decide. Then prove it.',
        body: 'The real product, running on synthetic data.',
      })
    },
  },
  {
    id: 'overview',
    label: 'Start here',
    summary: 'Three plain questions lead into what is stuck, whether the spend is justified, and what the AI was allowed to do.',
    seconds: 11,
    async run(c) {
      c.card(null)
      c.caption({ step: 'See', title: 'Start with three questions', body: 'Is anything stuck? Is the AI spend justified? What was the AI allowed to do? Verified, estimated and unmeasured value are never blended.' })
      c.showCursor(true)
      await c.point(await c.find(heading(exact(TERMS.askStuck))), 0.3, 0.5)
      await c.wait(1800)
      await c.point(await c.find(heading(exact(TERMS.askSpend))), 0.3, 0.5)
      await c.wait(1800)
      await c.point(await c.find(heading(exact(TERMS.askAllowed))), 0.3, 0.5)
      await c.wait(1800)
      c.caption({ step: 'See', title: 'From a question to the cause', body: 'Each answer opens the situation behind it on the org map.' })
      await c.click(await c.find((d) => byText(d, 'button', exact(TERMS.investigateUrgent))))
    },
  },
  {
    id: 'conflict',
    label: 'A conflict on the map',
    summary: 'The org map draws ownership and finds two missions working against each other.',
    seconds: 11,
    async run(c) {
      if (!c.hash().startsWith('#/workforce')) c.go('#/workforce')
      await c.find((d) => d.querySelector<HTMLElement>('button.finding'))
      c.caption({ step: 'Understand', title: 'The org map', body: 'Each person owns a pod of AI workers. Findings are derived from live data, never stored.' })
      c.showCursor(true)
      await c.point(await c.find((d) => d.querySelector<HTMLElement>('.mapview__stage')), 0.5, 0.45)
      await c.wait(2200)
      await c.click(await c.find(finding(FINDING_LABEL['conflicting-objectives'])))
      c.caption({ step: 'Understand', title: 'Two missions, one resource', body: 'Pay suppliers early and Minimize idle cash are working against each other on one liquidity buffer.' })
      await c.wait(1500)
      await c.point(await c.find((d) => d.querySelector<HTMLElement>('.situation')), 0.5, 0.35)
    },
  },
  {
    id: 'blocked',
    label: 'A blocked decision',
    summary: 'A $2.4M settlement waits on an approver who is out of office; the decision moves to someone available.',
    seconds: 13,
    async run(c) {
      // Each chapter can be the first one played, so it opens its own page when it is not already there.
      if (!c.hash().startsWith('#/workforce')) c.go('#/workforce')
      await c.find((d) => d.querySelector<HTMLElement>('button.finding'))
      c.showCursor(true)
      await c.click(await c.find(finding(FINDING_LABEL['blocked-decision'])))
      c.caption({ step: 'Decide', title: 'A $2.4M settlement is blocked', body: 'Its approver is out of office with no delegate, and the custodian cut-off is hours away.' })
      await c.wait(2200)
      await c.point(await c.find((d) => d.querySelector<HTMLElement>('.situation')), 0.5, 0.4)
      await c.wait(1800)
      await c.click(await c.find((d) => byText(d, 'button', exact(TERMS.moveDecision))))
      c.caption({ step: 'Decide', title: 'The decision moves to someone available', body: 'An audit event is written, and the finding clears from the map and the queue together.' })
      await c.wait(3500)
    },
  },
  {
    id: 'cost',
    label: 'Spend without proof',
    summary: 'Modeled cost is rising on a mission with no verified value; pausing the workers lowers the run-rate.',
    seconds: 9,
    async run(c) {
      if (!c.hash().startsWith('#/workforce')) c.go('#/workforce')
      await c.find((d) => d.querySelector<HTMLElement>('button.finding'))
      c.showCursor(true)
      await c.click(await c.find(finding(FINDING_LABEL['cost-without-proof'])))
      c.caption({ step: 'Decide', title: 'Cost is up, with nothing verified', body: 'Modeled run cost rose 74% on 14 workers with no verified value. The previous period is a labeled simulation, not a measurement.' })
      await c.wait(2400)
      await c.click(await c.find((d) => byText(d, 'button', /^Pause \d+ workers$/)))
      c.caption({ step: 'Decide', title: 'Pausing removes the spend, and is on the record', body: 'The run-rate falls, the workers are drawn as paused, and one audit event is written.' })
      await c.wait(2000)
    },
  },
  {
    id: 'live',
    label: 'Authority changes mid-flight',
    summary: 'A wire is staged, its permission is revoked, and the execution step is prevented, with the decision stored.',
    seconds: 18,
    async run(c) {
      c.go('#/governance/op-c1')
      await c.find((d) => byText(d, 'button', exact(TERMS.runStep)))
      c.caption({ step: 'Prove', title: 'A $480,000 wire is staged', body: 'Payments-Disburse-003 is authorized today. Then its permission changes before the step runs.' })
      c.showCursor(true)
      await c.wait(1800)
      await c.click(await c.find((d) => byText(d, 'button', exact(TERMS.changePermissions))))
      const revoke = await c.find((d) => Array.from(d.querySelectorAll<HTMLElement>('label.choice')).find((l) => exact(TERMS.revoke).test((l.textContent ?? '').trim())))
      await c.click(revoke)
      await c.type(await c.find((d) => d.querySelector<HTMLElement>('#perm-reason')), 'Vendor under sanctions review')
      await c.click(await c.find((d) => byText(d, 'footer button, .overlay button, button', exact(TERMS.revoke))))
      await c.wait(800)
      c.caption({ step: 'Prove', title: 'Now the step runs', body: 'Authorization is judged at execution time, not when the work began.' })
      await c.click(await c.find((d) => byText(d, 'button', exact(TERMS.runStep))))
      c.caption({ step: 'Prove', title: 'Execution prevented, and recorded', body: 'The stored decision keeps the permission state it relied on, so it can be reconstructed later.' })
      await c.wait(2200)
    },
  },
  {
    id: 'replay',
    label: 'Reconstruct an incident',
    summary: 'Scrub a real incident and see what the AI worker was authorized to do then, beside what is permitted today.',
    seconds: 14,
    async run(c) {
      c.go('#/governance/op-d1')
      await c.find((d) => d.querySelector<HTMLElement>('.rp'))
      c.caption({ step: 'Prove', title: 'Reconstruct the incident', body: 'A wire was executed. What was the AI worker authorized to do at that moment?' })
      c.showCursor(true)
      await c.point(await c.find((d) => d.querySelector<HTMLElement>('.rp__lanes')), 0.5, 0.5)
      await c.wait(1500)
      await c.click(await c.find((d) => d.querySelector<HTMLElement>('.rp__mark')))
      await c.wait(1200)
      for (let i = 0; i < 6; i++) {
        const next = await c.find((d) => byText(d, 'button', exact(TERMS.next)), 800)
        if (!next || (next as HTMLButtonElement).disabled) break
        await c.click(next)
        if (i === 1) c.caption({ step: 'Prove', title: 'Authorized then, permitted now', body: 'Hatched bands mark where the authority at that point differs from today. The stored decision never changes.' })
        if (i === 3) c.caption({ step: 'Prove', title: 'Evidence from the record', body: 'Rebuilt from the append-only permission log in sequence order, with who changed what and who was accountable.' })
        await c.wait(1900)
      }
      await c.point(await c.find((d) => d.querySelector<HTMLElement>('.rp__compare')), 0.5, 0.5)
    },
  },
  {
    id: 'outro',
    label: 'Try it yourself',
    summary: 'One workforce. Full accountability.',
    seconds: 6,
    async run(c) {
      c.caption(null)
      c.showCursor(false)
      c.card({
        eyebrow: 'Wand Horizon',
        title: 'One workforce. Full accountability.',
        body: 'Everything you just saw ran in the real app on synthetic data.',
        action: true,
      })
    },
  },
]

export const TOTAL_SECONDS = SCENES.reduce((a, s) => a + s.seconds, 0)
export const SCENE_STARTS = SCENES.map((_, i) => SCENES.slice(0, i).reduce((a, s) => a + s.seconds, 0))
