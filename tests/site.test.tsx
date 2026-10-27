import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Root from '../src/Root'
import { GITHUB_REPO_URL } from '../src/config/site'
import { routeOf } from '../src/state/router'

/** Lazy routes load their chunk on first use; allow for that. */
const SLOW = { timeout: 10_000 }

async function goTo(hash: string) {
  await act(async () => {
    window.location.hash = hash
    await new Promise((r) => setTimeout(r, 0))
  })
}

describe('site routes', () => {
  it('maps hashes to the landing page or the System', () => {
    for (const h of ['', '#', '#/', '#/home']) expect(routeOf(h)).toBe('home')
    expect(routeOf('#/demo')).toBe('demo')
    expect(routeOf('#/intro')).toBe('intro')
    for (const h of ['#/system', '#/overview', '#/queue/op-a1', '#/workforce/registry', '#/governance/op-d1']) expect(routeOf(h)).toBe('system')
  })

  it('opens on the landing page by default, with both calls to action', () => {
    render(<Root />)
    expect(screen.getByRole('heading', { level: 1, name: /One workforce\. Full accountability\./ })).toBeInTheDocument()
    for (const link of screen.getAllByRole('link', { name: /Explore the System/ })) expect(link).toHaveAttribute('href', '#/system')
    const repo = screen.getAllByRole('link', { name: /View GitHub Repository/ })[0]
    expect(repo).toHaveAttribute('href', GITHUB_REPO_URL)
    expect(screen.getByText(/How can leadership understand the performance of 50 human employees and 500 AI workers/)).toBeInTheDocument()
    expect(screen.getByText(/What an AI worker was authorized to do at a specific moment|what an AI worker was authorized to do at a specific moment/)).toBeInTheDocument()
  })

  it('links the landing page to the demo player', () => {
    render(<Root />)
    for (const link of screen.getAllByRole('link', { name: /Watch the demo/ })) expect(link).toHaveAttribute('href', '#/demo')
  })

  it('opens the demo player from its URL with its chapters, ready to play', async () => {
    window.location.hash = '#/demo'
    render(<Root />)
    expect(routeOf(window.location.hash)).toBe('demo')
    expect(await screen.findByRole('heading', { level: 1, name: /Wand Horizon in about/ }, SLOW)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play the demo' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Reconstruct an incident/ }).length).toBeGreaterThan(0)
    expect(screen.getByText(/not a rendered video file/)).toBeInTheDocument()
  })

  it('opens the brand film with its title, controls and links on, ready to replay', async () => {
    window.location.hash = '#/intro'
    render(<Root />)
    expect(await screen.findByRole('heading', { level: 1, name: /Command the intelligence workforce/ }, SLOW)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Turn sound on' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Replay' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Watch the product demo/ })).toHaveAttribute('href', '#/demo')
  })

  it('loads the System directly from its URL and links back to the introduction', async () => {
    window.location.hash = '#/queue'
    render(<Root />)
    expect(await screen.findByRole('navigation', { name: 'Primary' }, SLOW)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Introduction' })).toHaveAttribute('href', '#/')
  })

  it('switches between the landing page and the System when the hash changes', async () => {
    render(<Root />)
    await goTo('#/system')
    expect(await screen.findByRole('navigation', { name: 'Primary' }, SLOW)).toBeInTheDocument()
    expect(document.title).toMatch(/System/)
    await goTo('#/')
    expect(await screen.findByRole('heading', { level: 1 }, SLOW)).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument()
  })
})
