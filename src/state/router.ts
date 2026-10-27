import { SCREENS, type Place, type Screen } from './navContext'

/**
 * The one place that knows the URL grammar. The whole website lives in the URL hash, so direct loads and refreshes
 * work on any static host without server rewrites:
 *
 *   #/ (or empty, or #/home)           Introduction landing page
 *   #/intro                            Brand film (a self-playing cinematic animation)
 *   #/demo                             Product demo (a scripted walkthrough of the real System)
 *   #/system, #/overview, #/queue ...  the System (the application); #/system opens its Overview
 *   #/<screen>/<id>                    a screen inside the System, optionally on one record (e.g. #/governance/op-d1)
 *
 * `?embed=1` (before the hash) renders only the System: it is how the demo player shows the real application.
 */
export type Route = 'home' | 'demo' | 'intro' | 'system'

export function routeOf(hash: string): Route {
  const first = hash.replace(/^#\/?/, '').split('/')[0]
  if (first === '' || first === 'home') return 'home'
  if (first === 'demo') return 'demo'
  if (first === 'intro') return 'intro'
  return 'system'
}

/** A System location from a hash. Unknown screens fall back to the overview. */
export function parseSystemHash(hash: string): Place {
  const [, s, id] = hash.split('/')
  return { screen: (SCREENS as string[]).includes(s) ? (s as Screen) : 'overview', id: id ? decodeURIComponent(id) : null }
}

export const systemHashFor = (p: Place) => `#/${p.screen}${p.id ? `/${encodeURIComponent(p.id)}` : ''}`

export const isEmbed = (search = typeof window !== 'undefined' ? window.location.search : '') => new URLSearchParams(search).has('embed')

export const HOME_HASH = '#/'
export const DEMO_HASH = '#/demo'
export const INTRO_HASH = '#/intro'
export const SYSTEM_HASH = '#/system'
