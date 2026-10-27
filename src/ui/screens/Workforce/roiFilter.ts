import type { RoiStatus } from '../../../domain/roi'

export type RoiFilter = 'all' | 'attention' | RoiStatus

/** `registry:attention`, `registry:red` ... from a link; anything else means no preset. */
export function roiPreset(selectedId: string | null): RoiFilter {
  const v = selectedId?.split(':')[1]
  return v === 'attention' || v === 'green' || v === 'amber' || v === 'red' || v === 'grey' ? v : 'all'
}
