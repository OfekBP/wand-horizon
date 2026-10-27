/** Display helpers shared by the domain copy, the fixtures and the UI. Pure and dependency free. */

export const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

const utc = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
export const formatUtc = (iso: string) => `${utc.format(new Date(iso))} UTC`

/** "20h", "2d 3h": deadlines and waiting times between two ISO times. */
export function span(fromIso: string, toIso: string): string {
  const mins = Math.max(0, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60_000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  return d > 0 ? `${d}d ${h}h` : `${h}h`
}
