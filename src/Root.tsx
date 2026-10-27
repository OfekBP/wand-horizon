import { useEffect, useState } from 'react'
import { Analytics } from '@vercel/analytics/react'
import App from './App'
import { SITE_NAME, SITE_TAGLINE } from './config/site'
import { routeOf } from './state/route'
import { Landing } from './ui/landing/Landing'

/** Chooses between the landing page and the System from the URL hash. */
export default function Root() {
  const [route, setRoute] = useState(() => routeOf(window.location.hash))

  useEffect(() => {
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
    document.title = route === 'home' ? `${SITE_NAME}: ${SITE_TAGLINE}` : `System · ${SITE_NAME}`
  }, [route])

  return (
    <>
      {route === 'home' ? <Landing /> : <App />}
      <Analytics />
    </>
  )
}
