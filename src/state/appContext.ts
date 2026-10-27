import { createContext, useContext } from 'react'
import type { Result, UserAction } from '../domain/reducer'
import type { Index } from '../domain/selectors'
import type { Actor, AppState, SimRole } from '../domain/types'

export interface AppCtx {
  state: AppState
  index: Index
  personas: Record<SimRole, Actor>
  /** The only way UI changes domain state: a pure transition (applyAction) applied to the latest state. */
  act: (action: UserAction) => Result
  setActingAs: (role: SimRole) => void
  reset: () => void
}

export const AppContext = createContext<AppCtx | null>(null)

export function useApp(): AppCtx {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
