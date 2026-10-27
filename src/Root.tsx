import { lazy, Suspense, useEffect, useState } from 'react'
import { SITE_NAME, SITE_TAGLINE } from './config/site'
import { routeOf, type Route } from './state/route'
import { Landing } from './ui/landing/Landing'

// The landing page ships on its own. The System, the demo player and the brand film load when their route is opened,
// so a first visit does not download the domain model, the fixtures or the audio code.
const App = lazy(() => import('./App'))
const Demo = lazy(() => import('./ui/demo/Demo').then((m) => ({ default: m.Demo })))
const Intro = lazy(() => import('./ui/intro/Intro').then((m) => ({ default: m.Intro })))

function Loading() {
  return (
    <div role="status" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#8a8296', fontSize: 14, background: 'var(--route-bg, transparent)' }}>
      Loading…
    </div>
  )
}

/** The demo player embeds the System with ?embed=1: the app only, with the site-level links hidden. */
const EMBED = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('embed')

const TITLE: Record<Route, string> = {
  home: `${SITE_NAME}: ${SITE_TAGLINE}`,
  demo: `Demo · ${SITE_NAME}`,
  intro: `${SITE_NAME}: Command the intelligence workforce.`,
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
  return <Suspense fallback={<Loading />}>{route === 'demo' ? <Demo /> : route === 'intro' ? <Intro /> : <App />}</Suspense>
}
