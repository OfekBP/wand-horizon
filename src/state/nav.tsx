import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { NavContext, SCREENS, type GoOptions, type Place, type Screen, type Toast } from './navContext'

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
