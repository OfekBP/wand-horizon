import { describe, expect, it } from 'vitest'
import { isEmbed, parseSystemHash, routeOf, systemHashFor } from '../src/state/router'

describe('router grammar', () => {
  it('routes the site pages', () => {
    for (const h of ['', '#', '#/', '#/home']) expect(routeOf(h)).toBe('home')
    expect(routeOf('#/demo')).toBe('demo')
    expect(routeOf('#/intro')).toBe('intro')
    for (const h of ['#/system', '#/overview', '#/queue/op-a1', '#/workforce/registry', '#/governance/op-d1']) expect(routeOf(h)).toBe('system')
  })

  it('parses and rebuilds System locations without changing the URL', () => {
    for (const h of ['#/overview', '#/queue/op-a1', '#/workforce/blocked%3Aop-a1', '#/governance/op-d1', '#/workforce/registry']) {
      expect(systemHashFor(parseSystemHash(h))).toBe(h)
    }
  })

  it('falls back to the overview for #/system and unknown screens', () => {
    expect(parseSystemHash('#/system')).toEqual({ screen: 'overview', id: null })
    expect(parseSystemHash('#/nope/x').screen).toBe('overview')
  })

  it('detects the embedded System', () => {
    expect(isEmbed('?embed=1&run=3')).toBe(true)
    expect(isEmbed('')).toBe(false)
  })
})
