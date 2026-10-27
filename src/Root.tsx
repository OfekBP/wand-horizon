import { useEffect, useState } from 'react'
import App from './App'
import { SITE_NAME, SITE_TAGLINE } from './config/site'
import { routeOf, type Route } from './state/route'
import { Demo } from './ui/demo/Demo'
import { Landing } from './ui/landing/Landing'

/** The demo player embeds the System with ?embed=1: the app only, with the site-level links hidden. */
const EMBED = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('embed')

const TITLE: Record<Route, string> = {
  home: `${SITE_NAME}: ${SITE_TAGLINE}`,
  demo: `Demo · ${SITE_NAME}`,
  system: `System · ${SITE_NAME}`,
}

/** Chooses between the landing page, the demo and the System from the URL hash. */
export default function Root() {
  const [route, setRoute] = useState<Route>(() => (EMBED ? 'system' : routeOf(window.location.hash)))

  useEffect(() => {
    if (EMBED) return
    const onHash = () => {
      const next = routeOf(window.location.hash)
      setRoute((prev) => {
        if (prev !== next) window.scrollTo(0, 0)
        return next
      })
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.route = route
    if (EMBED) document.documentElement.dataset.embed = '1'
    document.title = TITLE[route]
  }, [route])

  if (route === 'home') return <Landing />
  if (route === 'demo') return <Demo />
  return <App />
}
