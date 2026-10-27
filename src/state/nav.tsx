import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

export type Screen = 'overview' | 'queue' | 'workforce' | 'governance'
const SCREENS: Screen[] = ['overview', 'queue', 'workforce', 'governance']

export const SCREEN_LABEL: Record<Screen, string> = {
  overview: 'Overview',
  queue: 'Work Queue',
  workforce: 'Workforce',
  governance: 'Governance',
}

interface Toast {
  message: string
  link?: { label: string; screen: Screen; id?: string }
}

interface Place {
  screen: Screen
  id: string | null
}

interface GoOptions {
  /** A fresh start from the primary navigation: forgets where the user came from. */
  fresh?: boolean
}

interface Ctx {
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

const NavContext = createContext<Ctx | null>(null)

function parse(hash: string): Place {
  const [, s, id] = hash.split('/')
  return { screen: (SCREENS as string[]).includes(s) ? (s as Screen) : 'overview', id: id ? decodeURIComponent(id) : null }
}

const hashFor = (p: Place) => `#/${p.screen}${p.id ? `/${encodeURIComponent(p.id)}` : ''}`

/** Navigation lives in the URL hash so refresh and links work, without a router dependency. */
export function NavProvider({ children }: { children: ReactNode }) {
  const [loc, setLoc] = useState<Place>(() => parse(window.location.hash))
  const [backTo, setBackTo] = useState<Place | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const locRef = useRef(loc)
  useEffect(() => {
    locRef.current = loc
  }, [loc])

  useEffect(() => {
    const onHash = () => setLoc(parse(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = useCallback((place: Place) => {
    const next = hashFor(place)
    if (window.location.hash === next) setLoc(place)
    else window.location.hash = next
  }, [])

  const go = useCallback(
    (screen: Screen, id?: string | null, options?: GoOptions) => {
      const from = locRef.current
      if (options?.fresh) setBackTo(null)
      else if (from.screen !== screen) setBackTo(from)
      navigate({ screen, id: id ?? null })
    },
    [navigate],
  )

  const back = useCallback(() => {
    if (!backTo) return
    const target = backTo
    setBackTo(null)
    navigate(target)
  }, [backTo, navigate])

  const dismissToast = useCallback(() => setToast(null), [])
  const notify = useCallback((message: string, link?: Toast['link']) => {
    setToast({ message, link })
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast(null), 7000)
  }, [])

  const value = useMemo(
    () => ({ screen: loc.screen, selectedId: loc.id, go, backTo, back, toast, notify, dismissToast }),
    [loc, go, backTo, back, toast, notify, dismissToast],
  )
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>
}

export function useNav(): Ctx {
  const ctx = useContext(NavContext)
  if (!ctx) throw new Error('useNav must be used inside NavProvider')
  return ctx
}
