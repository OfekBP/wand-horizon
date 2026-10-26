import type { PerformanceConcern } from '../../../domain/types'
import { useNav } from '../../../state/nav'
import { useApp } from '../../../state/store'
import { Badge, SeverityBadge } from '../../primitives/Badge'
import { Button } from '../../primitives/Button'
import { Overlay } from '../../primitives/Overlay'
import { formatMetric } from './format'

export function ConcernDrawer({ concern, onClose }: { concern: PerformanceConcern; onClose: () => void }) {
  const { index } = useApp()
  const { go } = useNav()
  const worker = index.workerById.get(concern.workerId)
  const owner = worker?.ownerId ? index.workerById.get(worker.ownerId) : undefined
  return (
    <Overlay
      variant="drawer"
      title={`${concern.metric} above threshold`}
      subtitle={
        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
          <SeverityBadge severity={concern.severity} />
          <Badge>{concern.status === 'open' ? 'Open' : 'Acknowledged'}</Badge>
        </span>
      }
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          <Button variant="primary" onClick={() => worker && go('workforce', worker.id)}>
            Open worker profile
          </Button>
        </>
      }
    >
      <p className="small">{concern.note}</p>
      <dl className="facts">
        <div>
          <dt>AI worker</dt>
          <dd>{worker?.name}</dd>
        </div>
        <div>
          <dt>Accountable owner</dt>
          <dd>{owner?.name ?? 'None'}</dd>
        </div>
        <div>
          <dt>Observed</dt>
          <dd className="num">{formatMetric(concern.observed, concern.unit)}</dd>
        </div>
        <div>
          <dt>Threshold</dt>
          <dd className="num">{formatMetric(concern.threshold, concern.unit)}</dd>
        </div>
      </dl>
    </Overlay>
  )
}
