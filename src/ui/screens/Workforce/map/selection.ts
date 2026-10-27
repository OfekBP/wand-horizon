import type { FindingKind } from '../../../../domain/findings'

/** What is focused on the map. It lives in the URL (the nav id), so every screen can link to it. */
export type Selection =
  | { kind: 'finding'; id: string }
  | { kind: 'worker'; id: string }
  | { kind: 'team'; id: string }
  | { kind: 'mission'; id: string }
  | { kind: 'op'; id: string }

export function parseSelection(id: string | null): Selection | null {
  if (!id) return null
  if (/^(blocked|conflict|cost|risk):/.test(id)) return { kind: 'finding', id }
  if (id.startsWith('op:')) return { kind: 'op', id: id.slice(3) }
  if (id.startsWith('t-')) return { kind: 'team', id }
  if (id.startsWith('m-')) return { kind: 'mission', id }
  if (/^[ah]-/.test(id)) return { kind: 'worker', id }
  return null
}

export type Lens = 'ownership' | 'value' | 'conflicts' | 'blocked' | 'authority' | 'missions'

export const LENSES: Array<{ key: Lens; label: string; help: string }> = [
  { key: 'ownership', label: 'Ownership', help: 'Who answers for whom. Each person and the AI workers they are accountable for.' },
  { key: 'value', label: 'Value and cost', help: 'Dots are drawn by value evidence and sized by modeled cost. Amber rings: modeled cost up 25% or more with no verified value (simulated comparison).' },
  { key: 'conflicts', label: 'Conflicts', help: 'Workers acting on the same resource. Solid red: opposing outcomes. Dashed amber: duplicated work.' },
  { key: 'blocked', label: 'Blocked', help: 'Operations waiting on a human decision, joined to the person who must take it.' },
  { key: 'authority', label: 'Authority', help: 'Workers whose permissions changed while an operation was in flight.' },
  { key: 'missions', label: 'Missions', help: 'Select a mission to see its workers across teams.' },
]

export const lensForFinding = (kind: FindingKind): Lens =>
  kind === 'blocked-decision' ? 'blocked' : kind === 'cost-without-proof' ? 'value' : kind === 'authority-at-risk' ? 'authority' : 'conflicts'
