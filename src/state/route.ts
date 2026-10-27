/**
 * Site routes. The whole website lives in the URL hash, so direct loads and refreshes work on any static host
 * without server rewrites:
 *
 *   #/ (or empty, or #/home)           Introduction landing page
 *   #/intro                            Brand film (a self-playing cinematic animation)
 *   #/demo                             Product demo (a scripted walkthrough of the real System)
 *   #/system, #/overview, #/queue ...  the System (the application); #/system opens its Overview
 */
export type Route = 'home' | 'demo' | 'intro' | 'system'

export function routeOf(hash: string): Route {
  const first = hash.replace(/^#\/?/, '').split('/')[0]
  if (first === '' || first === 'home') return 'home'
  if (first === 'demo') return 'demo'
  if (first === 'intro') return 'intro'
  return 'system'
}

export const HOME_HASH = '#/'
export const DEMO_HASH = '#/demo'
export const INTRO_HASH = '#/intro'
export const SYSTEM_HASH = '#/system'
