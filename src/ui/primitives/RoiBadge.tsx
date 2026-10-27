import { fmtMultiple, ROI_ACTION, ROI_LABEL, ROI_POLICY, type RoiStatus } from '../../domain/roi'
import { Badge } from './Badge'

const TONE = { green: 'ok', amber: 'high', red: 'critical', grey: 'medium' } as const

/** Colour is never the only signal: each state also has its own shape and a word. */
function Shape({ status }: { status: RoiStatus }) {
  const common = { width: 11, height: 11, viewBox: '0 0 12 12', 'aria-hidden': true as const, style: { flex: 'none' as const } }
  switch (status) {
    case 'green':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="m2.5 6.4 2.4 2.4 4.6-5" />
        </svg>
      )
    case 'amber':
      return (
        <svg {...common} fill="currentColor">
          <path d="M6 1.6 11 10.4H1z" />
        </svg>
      )
    case 'red':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="m3 3 6 6M9 3 3 9" />
        </svg>
      )
    default:
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M2.5 6h7" />
        </svg>
      )
  }
}

/** "8.2× Pays off" with a shape, a word and a colour. `compact` drops the word for dense tables. */
export function RoiBadge({ status, multiple, compact }: { status: RoiStatus; multiple?: number | null; compact?: boolean }) {
  const label = ROI_LABEL[status]
  const m = multiple === undefined || multiple === null ? null : fmtMultiple(multiple)
  const full = `${label}${m ? `, ${m}` : ''}. Suggested action: ${ROI_ACTION[status]}.`
  return (
    <span title={full} aria-label={full} style={{ display: 'inline-flex' }}>
      <Badge tone={TONE[status]}>
        <Shape status={status} />
        {m && <strong className="num">{m}</strong>}
        {!compact && <span className="roi__word">{label}</span>}
      </Badge>
    </span>
  )
}

export function RoiLegend() {
  return (
    <p className="small muted roi-legend">
      Return = verified value ÷ modeled monthly cost, trailing 30 days. <RoiBadge status="green" compact /> at least {ROI_POLICY.greenAt}× · <RoiBadge status="amber" compact /> {ROI_POLICY.redBelow}× to {ROI_POLICY.greenAt}× or only estimated ·{' '}
      <RoiBadge status="red" compact /> under {ROI_POLICY.redBelow}×, or unproven and rising · <RoiBadge status="grey" compact /> no value data. Estimated value never counts. Synthetic data.
    </p>
  )
}
