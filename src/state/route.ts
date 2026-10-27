/**
 * Site routes. The whole website lives in the URL hash, so direct loads and refreshes work on any static host
 * without server rewrites:
 *
 *   #/ (or empty, or #/home)           Introduction landing page
 *   #/system, #/overview, #/queue ...  the System (the application); #/system opens its Overview
 *
 * To add a demo video page later, add a 'demo' route here and render it in Root.tsx.
 */
export type Route = 'home' | 'system'

export function routeOf(hash: string): Route {
  const first = hash.replace(/^#\/?/, '').split('/')[0]
  return first === '' || first === 'home' ? 'home' : 'system'
}

export const HOME_HASH = '#/'
export const SYSTEM_HASH = '#/system'
