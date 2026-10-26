import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

export type Screen = 'overview' | 'queue' | 'workforce' | 'governance'
const SCREENS: Screen[] = ['overview', 'queue', 'workforce', 'governance']

interface Toast {
  message: string
  link?: { label: string; screen: Screen; id?: string }
}

interface Ctx {
  screen: Screen
  selectedId: string | null
  go: (screen: Screen, id?: string | null) => void
  toast: Toast | null
  notify: (message: string, link?: Toast['link']) => void
  dismissToast: () => void
}

const NavContext = createContext<Ctx | null>(null)

function parse(hash: string): { screen: Screen; id: string | null } {
  const [, s, id] = hash.split('/')
  return { screen: (SCREENS as string[]).includes(s) ? (s as Screen) : 'overview', id: id ? decodeURIComponent(id) : null }
}

/** Navigation lives in the URL hash so refresh and links work, without a router dependency. */
export function NavProvider({ children }: { children: ReactNode }) {
  const [loc, setLoc] = useState(() => parse(window.location.hash))
  const [toast, setToast] = useState<Toast | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const onHash = () => setLoc(parse(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = useCallback((screen: Screen, id?: string | null) => {
    const next = `#/${screen}${id ? `/${encodeURIComponent(id)}` : ''}`
    if (window.location.hash === next) setLoc({ screen, id: id ?? null })
    else window.location.hash = next
  }, [])

  const dismissToast = useCallback(() => setToast(null), [])
  const notify = useCallback((message: string, link?: Toast['link']) => {
    setToast({ message, link })
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast(null), 7000)
  }, [])

  const value = useMemo(
    () => ({ screen: loc.screen, selectedId: loc.id, go, toast, notify, dismissToast }),
    [loc, go, toast, notify, dismissToast],
  )
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>
}

export function useNav(): Ctx {
  const ctx = useContext(NavContext)
  if (!ctx) throw new Error('useNav must be used inside NavProvider')
  return ctx
}
