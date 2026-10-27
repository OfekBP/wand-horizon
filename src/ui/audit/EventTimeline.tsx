import { describeEvent } from '../../domain/audit'
import type { AuditEvent } from '../../domain/types'
import { useApp } from '../../state/appContext'
import { dateTime } from '../format'
import './audit.css'

interface Props {
  events: AuditEvent[]
  /** Events with seq above this are drawn as "after the outcome" (they never rewrite it). */
  afterSeq?: number | null
  selectedSeq?: number | null
  onSelect?: (event: AuditEvent) => void
}

/** Renders audit events in seq order. Timestamps are shown for reading only. */
export function EventTimeline({ events, afterSeq, selectedSeq, onSelect }: Props) {
  const { index } = useApp()
  const nameOf = (id: string) => index.workerById.get(id)?.name ?? id

  if (events.length === 0) return <div className="empty">No events recorded.</div>

  return (
    <ol className="tl">
      {events.map((e) => {
        const v = describeEvent(e, nameOf)
        const after = afterSeq != null && e.seq > afterSeq
        const body = (
          <>
            <div className="tl__top">
              <span className="tl__title">{v.title}</span>
              <span className="tl__meta num">{dateTime(e.at)}</span>
            </div>
            <div className="tl__lines">
              <span>By {e.actor}</span>
              {v.lines.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </div>
            {after && <span className="tl__tag">Recorded after the outcome. It does not change it.</span>}
          </>
        )
        return (
          <li key={e.id} className={`tl__item tl__item--${v.tone}${after ? ' tl__item--after' : ''}`}>
            <span className="tl__seq seq" title="Sequence number: the order of record">
              #{e.seq}
            </span>
            <span className="tl__dot" aria-hidden="true" />
            {onSelect ? (
              <button className="tl__card" aria-current={selectedSeq === e.seq} onClick={() => onSelect(e)}>
                {body}
              </button>
            ) : (
              <div className="tl__card">{body}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
