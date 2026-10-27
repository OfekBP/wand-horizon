import { usd } from '../domain/format'

export const money = usd

export const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`

const dtf = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** Timestamps are display-only; ordering always comes from seq. */
export const dateTime = (iso: string) => `${dtf.format(new Date(iso))} UTC`

export function age(fromIso: string, toIso: string): string {
  const mins = Math.max(0, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60_000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
