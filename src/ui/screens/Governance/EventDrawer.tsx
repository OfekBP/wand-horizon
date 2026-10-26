import { describeEvent } from '../../../domain/audit'
import type { AuditEvent } from '../../../domain/types'
import { useNav } from '../../../state/nav'
import { useApp } from '../../../state/store'
import { dateTime } from '../../format'
import { Button } from '../../primitives/Button'
import { Overlay } from '../../primitives/Overlay'
import { PermissionsList } from '../Workforce/PermissionsList'

/** Detail for events that do not belong to an operation (permission changes, conflict resolutions). */
export function EventDrawer({ event, onClose }: { event: AuditEvent; onClose: () => void }) {
  const { state, index } = useApp()
  const { go } = useNav()
  const nameOf = (id: string) => index.workerById.get(id)?.name ?? id
  const v = describeEvent(event, nameOf)
  return (
    <Overlay
      variant="drawer"
      title={v.title}
      subtitle={`Event #${event.seq} · ${dateTime(event.at)} · by ${event.actor}`}
      onClose={onClose}
      footer={
        <>
          {event.type === 'ConflictResolved' && <Button onClick={() => go('queue', event.conflictId)}>View conflict</Button>}
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <ul className="small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
        {v.lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      {event.type === 'PermissionChanged' && event.workerId && (
        <>
          <div>
            <div className="section-label" style={{ marginBottom: 8 }}>
              Before this change (as of #{event.seq - 1})
            </div>
            <PermissionsList events={state.events} workerId={event.workerId} cutoffSeq={event.seq - 1} changedScope={event.scope} />
          </div>
          <div>
            <div className="section-label" style={{ marginBottom: 8 }}>
              After this change (as of #{event.seq})
            </div>
            <PermissionsList events={state.events} workerId={event.workerId} cutoffSeq={event.seq} changedScope={event.scope} />
          </div>
        </>
      )}
    </Overlay>
  )
}
