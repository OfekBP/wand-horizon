import { createContext, useContext } from 'react'

export type Screen = 'overview' | 'queue' | 'workforce' | 'governance'
export const SCREENS: Screen[] = ['overview', 'queue', 'workforce', 'governance']

export const SCREEN_LABEL: Record<Screen, string> = {
  overview: 'Start here',
  queue: 'Needs attention',
  workforce: 'Org map',
  governance: 'AI accountability',
}

export interface Toast {
  message: string
  link?: { label: string; screen: Screen; id?: string }
}

export interface Place {
  screen: Screen
  id: string | null
}

export interface GoOptions {
  /** A fresh start from the primary navigation: forgets where the user came from. */
  fresh?: boolean
}

export interface NavCtx {
  screen: Screen
  selectedId: string | null
  go: (screen: Screen, id?: string | null, options?: GoOptions) => void
  /** Where the user came from when they crossed to another screen, so a case never loses its thread. */
  backTo: Place | null
  back: () => void
  toast: Toast | null
  notify: (message: string, link?: Toast['link']) => void
  dismissToast: () => void
}

export const NavContext = createContext<NavCtx | null>(null)

export function useNav(): NavCtx {
  const ctx = useContext(NavContext)
  if (!ctx) throw new Error('useNav must be used inside NavProvider')
  return ctx
}
