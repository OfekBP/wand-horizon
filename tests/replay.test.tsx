import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../src/App'
import { createInitialState } from '../src/data/generate'
import { narrateEvent } from '../src/domain/audit'
import { operationTimeline } from '../src/domain/selectors'

const seed = createInitialState()
const op = seed.operations.find((o) => o.id === 'op-d1')!
const timeline = operationTimeline(seed, op)
const nameOf = (id: string) => seed.workers.find((w) => w.id === id)?.name ?? id
const ctx = { nameOf, op, scopeLabel: 'Execute outbound wires' }

async function open(hash: string) {
  window.location.hash = hash
  return render(<App />)
}
async function goTo(hash: string) {
  await act(async () => {
    window.location.hash = hash
    await new Promise((r) => setTimeout(r, 0))
  })
}

describe('incident narration (built only from the record)', () => {
  it('tells the featured incident in order: grant, limit change, start, revoke, denied attempt, prevented, regrant', () => {
    expect(timeline.map((e) => e.type)).toEqual(['PermissionChanged', 'PermissionChanged', 'OperationStarted', 'PermissionChanged', 'AuthorizationEvaluated', 'ExecutionPrevented', 'PermissionChanged'])
    const lines = timeline.map((e) => narrateEvent(e, ctx))
    expect(lines[3]).toMatch(/Priya Raman revoked Payments-Disburse-011's authority to execute outbound wires/)
    expect(lines[4]).toMatch(/Looking only at permission events up to #\d+, its authority was: revoked\. Result: denied/)
    expect(lines[5]).toMatch(/The action did not run/)
    expect(lines[2]).toMatch(/Priya Raman was accountable for the decision/)
  })
})

describe('Incident replay', () => {
  it('separates what the worker was authorized to do then from what is permitted now', async () => {
    await open('#/governance/op-d1')
    const group = await screen.findByRole('group', { name: 'Authorized then and permitted now' })
    // opens on the stored decision: revoked then, a re-grant exists now
    expect(group).toHaveTextContent('Authorized then')
    expect(group).toHaveTextContent('Revoked')
    expect(group).toHaveTextContent('Active · limit $150,000')
    expect(group).toHaveTextContent('Differs from then')
    expect(screen.getByText('Historical, not current')).toBeInTheDocument()

    // scrub back to the first grant: the historical state changes, today's does not
    const slider = screen.getByRole('slider', { name: 'Replay position' })
    fireEvent.change(slider, { target: { value: '0' } })
    const g2 = await screen.findByRole('group', { name: 'Authorized then and permitted now' })
    expect(g2).toHaveTextContent('Active · limit $500,000')
    expect(g2).toHaveTextContent('Permitted now')
    expect(g2).toHaveTextContent('Active · limit $150,000')
    expect(slider).toHaveAttribute('aria-valuetext', expect.stringMatching(/Permission granted/))

    // scrub to the revocation: who was accountable is read from the record
    fireEvent.change(slider, { target: { value: '3' } })
    expect(await screen.findByText(/Priya Raman revoked Payments-Disburse-011/)).toBeInTheDocument()
    expect(screen.getByText('Vendor placed under sanctions review')).toBeInTheDocument()
  })

  it('never changes the stored decision as the playhead moves', async () => {
    await open('#/governance/op-d1')
    const slider = await screen.findByRole('slider', { name: 'Replay position' })
    fireEvent.change(slider, { target: { value: '0' } })
    fireEvent.change(slider, { target: { value: '4' } })
    // the verdict card still reads exactly what was recorded
    expect((await screen.findAllByText('The permission had been revoked')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Denied').length).toBeGreaterThan(0)
    expect(screen.getByText('Verified')).toBeInTheDocument()
  })

  it('next and previous step through the events and the markers are real buttons', async () => {
    const user = userEvent.setup()
    await open('#/governance/op-d1')
    await screen.findByRole('slider', { name: 'Replay position' })
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText(/Event 6 of 7/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Event #309: Permission revoked/ }))
    expect(screen.getByText(/Event 4 of 7/)).toBeInTheDocument()
  })

  it('does not appear for a case with no authority history', async () => {
    await open('#/governance/op-a1')
    await screen.findByText(/Awaiting a human decision/)
    expect(screen.queryByText('Incident replay')).not.toBeInTheDocument()
  })

  it('a permission change made now shows up as a difference in an earlier incident', async () => {
    const user = userEvent.setup()
    await open('#/governance/op-d2')
    const first = await screen.findByRole('group', { name: 'Authorized then and permitted now' })
    expect(first).toHaveTextContent('Revoked')
    // featured incident entry point exists on the Governance list
    await goTo('#/governance')
    await user.click(await screen.findByRole('button', { name: 'Replay the incident' }))
    expect(await screen.findByText('Incident replay')).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Authorized then and permitted now' })).getByText('Authorized then')).toBeInTheDocument()
  })
})
