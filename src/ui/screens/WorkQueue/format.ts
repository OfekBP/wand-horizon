import type { PerformanceConcern } from '../../../domain/types'

export function formatMetric(value: number, unit: PerformanceConcern['unit']): string {
  if (unit === '%') return `${value}%`
  if (unit === '$') return `$${value.toFixed(2)}`
  return `${value} min`
}
