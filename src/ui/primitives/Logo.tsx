import { useId } from 'react'

export const PRODUCT_NAME = 'Accord'
export const PRODUCT_LINE = 'Run the hybrid workforce. Prove what it was allowed to do.'

/**
 * The mark: a circle (people) and a rounded square (AI workers) overlap.
 * The overlap, filled, is the region of delegated and authorized authority.
 * `tone` picks stroke and fill for light or dark grounds.
 */
export function LogoMark({ size = 28, tone = 'light' }: { size?: number; tone?: 'light' | 'dark' }) {
  const id = useId()
  const stroke = tone === 'dark' ? 'var(--night-ink)' : 'var(--ink)'
  const fill = tone === 'dark' ? 'var(--night-accent)' : 'var(--accent)'
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <clipPath id={`${id}-c`}>
          <circle cx="12.5" cy="16" r="9.5" />
        </clipPath>
      </defs>
      <rect x="12.6" y="8.6" width="14.8" height="14.8" rx="3.4" transform="rotate(45 20 16)" fill={fill} clipPath={`url(#${id}-c)`} />
      <circle cx="12.5" cy="16" r="9.5" stroke={stroke} strokeWidth="2.2" />
      <rect x="12.6" y="8.6" width="14.8" height="14.8" rx="3.4" transform="rotate(45 20 16)" stroke={stroke} strokeWidth="2.2" />
    </svg>
  )
}

export function Logo({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  return (
    <span className="logo" aria-label={PRODUCT_NAME}>
      <LogoMark tone={tone} />
      <span className="logo__word" aria-hidden="true">
        accord
      </span>
    </span>
  )
}

