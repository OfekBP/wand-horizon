import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { createInitialState, personasFor } from '../data/generate'
import { MINUTE } from '../data/prng'
import { applyAction, type Action, type Result, type UserAction } from '../domain/reducer'
import { buildIndex, type Index } from '../domain/selectors'
import type { Actor, AppState, SimRole } from '../domain/types'

interface Ctx {
  state: AppState
  index: Index
  personas: Record<SimRole, Actor>
  /** The only way UI changes domain state: a pure transition (applyAction) applied to the latest state. */
  act: (action: UserAction) => Result
  setActingAs: (role: SimRole) => void
  reset: () => void
}

const AppContext = createContext<Ctx | null>(null)

export function AppProvider({ children, initial }: { children: ReactNode; initial?: AppState }) {
  const [state, setState] = useState<AppState>(() => initial ?? createInitialState())
  const latest = useRef(state)
  const personas = useMemo(() => personasFor(state), [state.workers]) // eslint-disable-line react-hooks/exhaustive-deps

  const commit = useCallback((next: AppState) => {
    latest.current = next
    setState(next)
  }, [])

  const act = useCallback(
    (action: UserAction): Result => {
      const current = latest.current
      // Simulated clock: each user action happens two minutes after the last event.
      const at = new Date(Date.parse(current.clock) + 2 * MINUTE).toISOString()
      const result = applyAction(current, { ...action, at, actor: current.actingAs.name } as Action)
      if (result.ok) commit(result.state)
      return result
    },
    [commit],
  )

  const setActingAs = useCallback(
    (role: SimRole) => commit({ ...latest.current, actingAs: personasFor(latest.current)[role] }),
    [commit],
  )
  const reset = useCallback(() => commit(initial ?? createInitialState()), [commit, initial])
  const index = useMemo(() => buildIndex(state), [state])

  const value = useMemo(() => ({ state, index, personas, act, setActingAs, reset }), [state, index, personas, act, setActingAs, reset])
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
