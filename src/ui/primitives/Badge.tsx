import type { ReactNode } from 'react'
import type { OperationStatus, Severity } from '../../domain/types'
import { cap } from '../format'

type Tone = Severity | 'ok' | 'accent' | 'neutral'

export function Badge({ tone = 'neutral', dot, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={`badge${tone === 'neutral' ? '' : ` badge--${tone}`}`}>
      {dot && <span className="badge__dot" />}
      {children}
    </span>
  )
}

export const SeverityBadge = ({ severity }: { severity: Severity }) => (
  <Badge tone={severity} dot>
    {cap(severity)}
  </Badge>
)

const STATUS: Record<OperationStatus, { label: string; tone: Tone }> = {
  in_progress: { label: 'In progress', tone: 'accent' },
  awaiting_approval: { label: 'Awaiting approval', tone: 'medium' },
  executed: { label: 'Executed', tone: 'ok' },
  prevented: { label: 'Prevented', tone: 'critical' },
}

export const StatusBadge = ({ status }: { status: OperationStatus }) => (
  <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>
)
