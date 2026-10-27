import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/** WCAG 2.2 AA for the text pairs the UI actually uses, read straight from tokens.css. */
const css = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8')
const tokens = new Map<string, string>()
for (const m of css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) tokens.set(m[1], m[2])

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const ratio = (fg: string, bg: string) => {
  const [a, b] = [lum(tokens.get(fg)!), lum(tokens.get(bg)!)].sort((x, y) => y - x)
  return (a + 0.05) / (b + 0.05)
}

const TEXT_PAIRS: Array<[string, string]> = [
  ['ink', 'surface'], ['ink', 'bg'], ['ink-2', 'surface'], ['ink-2', 'bg'],
  ['ink-3', 'surface'], ['ink-3', 'bg'], ['ink-3', 'surface-sunken'],
  ['accent', 'surface'], ['accent', 'accent-wash'], ['accent', 'bg'],
  ['critical', 'surface'], ['critical', 'critical-wash'],
  ['high', 'surface'], ['high', 'high-wash'],
  ['medium', 'medium-wash'], ['low', 'low-wash'], ['low', 'surface'],
  ['ok', 'surface'], ['ok', 'ok-wash'],
  ['night-ink', 'night'], ['night-ink-2', 'night'], ['night-accent', 'night'], ['night-critical', 'night'], ['night-ink-2', 'night'], ['night-accent', 'night-2'], ['night-ink', 'night-2'], ['night-ink-2', 'night-2'],
]

describe('text contrast (WCAG AA, 4.5:1)', () => {
  it.each(TEXT_PAIRS)('%s on %s', (fg, bg) => {
    expect(tokens.has(fg) && tokens.has(bg)).toBe(true)
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5)
  })

  it('white text on the accent and critical fills used by primary and danger buttons', () => {
    tokens.set('white', '#ffffff')
    expect(ratio('white', 'accent')).toBeGreaterThanOrEqual(4.5)
    expect(ratio('white', 'critical')).toBeGreaterThanOrEqual(4.5)
  })
})

