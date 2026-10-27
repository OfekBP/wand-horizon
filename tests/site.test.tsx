import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Root from '../src/Root'
import { GITHUB_REPO_URL } from '../src/config/site'
import { routeOf } from '../src/state/route'

async function goTo(hash: string) {
  await act(async () => {
    window.location.hash = hash
    await new Promise((r) => setTimeout(r, 0))
  })
}

describe('site routes', () => {
  it('maps hashes to the landing page or the System', () => {
    for (const h of ['', '#', '#/', '#/home']) expect(routeOf(h)).toBe('home')
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

  it('does not mention a demo video that does not exist', () => {
    render(<Root />)
    expect(screen.queryByText(/demo video|watch the demo/i)).not.toBeInTheDocument()
  })

  it('loads the System directly from its URL and links back to the introduction', async () => {
    window.location.hash = '#/queue'
    render(<Root />)
    expect(await screen.findByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Introduction' })).toHaveAttribute('href', '#/')
  })

  it('switches between the landing page and the System when the hash changes', async () => {
    render(<Root />)
    await goTo('#/system')
    expect(await screen.findByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
    expect(document.title).toMatch(/System/)
    await goTo('#/')
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument()
  })
})
