import { useState } from 'react'
import type { Worker } from '../../../domain/types'
import { useApp } from '../../../state/appContext'
import { Badge } from '../../primitives/Badge'
import { Button } from '../../primitives/Button'
import { Overlay } from '../../primitives/Overlay'
import { PermissionDialog } from './PermissionDialog'
import { WorkerProfile } from './WorkerProfile'
import { TERMS } from '../../terms'

export function WorkerDrawer({ worker, onClose }: { worker: Worker; onClose: () => void }) {
  const { index } = useApp()
  const [editing, setEditing] = useState(false)
  const team = index.teamById.get(worker.teamId)
  const isAi = worker.kind === 'ai'

  return (
    <>
      <Overlay
        variant="drawer"
        title={worker.name}
        subtitle={
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <Badge tone={isAi ? 'accent' : 'neutral'}>{isAi ? 'AI worker' : 'Person'}</Badge>
            <span>
              {worker.role} · {team?.name}
            </span>
          </span>
        }
        onClose={onClose}
        footer={
          <>
            <Button onClick={onClose}>Close</Button>
            {isAi && (
              <Button variant="primary" onClick={() => setEditing(true)}>
                {TERMS.changePermissions}
              </Button>
            )}
          </>
        }
      >
        <WorkerProfile worker={worker} />
      </Overlay>
      {editing && <PermissionDialog worker={worker} onClose={() => setEditing(false)} />}
    </>
  )
}
