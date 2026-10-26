import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../src/App'
import { createInitialState } from '../src/data/generate'

const seed = createInitialState()
const workerId = (name: string) => seed.workers.find((w) => w.name === name)!.id

async function open(hash: string) {
  window.location.hash = hash
  const view = render(<App />)
  return view
}

async function goTo(hash: string) {
  await act(async () => {
    window.location.hash = hash
    await new Promise((r) => setTimeout(r, 0))
  })
}

describe('Flow A: reassign a pending human decision', () => {
  it('changes the owner, keeps the operation awaiting approval, and records an audit event', async () => {
    const user = userEvent.setup()
    await open('#/queue/op-a1')
    const drawer = await screen.findByRole('dialog', { name: /SB-2291/ })
    expect(within(drawer).getByText('Elena Park')).toBeInTheDocument()
    expect(within(drawer).getByText('Awaiting approval')).toBeInTheDocument()

    await user.click(within(drawer).getByRole('button', { name: 'Reassign decision' }))
    const dialog = await screen.findByRole('dialog', { name: 'Reassign pending decision' })
    await user.selectOptions(within(dialog).getByLabelText('New decision owner'), workerId('Ingrid Novak'))
    await user.type(within(dialog).getByLabelText('Reason'), 'Elena is out of office')
    await user.click(within(dialog).getByRole('button', { name: 'Reassign decision' }))

    // owner changed, status unchanged
    const updated = await screen.findByRole('dialog', { name: /SB-2291/ })
    expect(within(updated).getByText('Ingrid Novak')).toBeInTheDocument()
    expect(within(updated).getByText('Awaiting approval')).toBeInTheDocument()
    expect(within(updated).getByText('Pending decision reassigned')).toBeInTheDocument()

    // and the audit history shows it
    await goTo('#/governance/op-a1')
    expect(await screen.findByText('Pending decision reassigned')).toBeInTheDocument()
    expect(screen.getByText(/Elena Park → Ingrid Novak/)).toBeInTheDocument()
  })

  it('does not offer "Run execution step" on an awaiting_approval operation', async () => {
    await open('#/governance/op-a1')
    expect(await screen.findByText(/Awaiting a human decision/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Run execution step' })).not.toBeInTheDocument()
  })
})

describe('Flow B: resolve a conflict', () => {
  it('requires an explicit choice and removes the conflict from the open list', async () => {
    const user = userEvent.setup()
    await open('#/queue/c-001')
    const drawer = await screen.findByRole('dialog', { name: /Intraday liquidity buffer/ })
    const resolve = within(drawer).getByRole('button', { name: 'Resolve conflict' })
    expect(resolve).toBeDisabled()

    await user.click(within(drawer).getByRole('radio', { name: /Liquidity-Forecast-005/ }))
    await user.type(within(drawer).getByLabelText('Resolution note'), 'Liquidity owns the buffer')
    await user.click(resolve)

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('tab', { name: /Conflicts/ })).toHaveTextContent('4')
    expect(screen.queryByText('Intraday liquidity buffer (USD operating account)')).not.toBeInTheDocument()
  })
})

describe('Flows C and D: permission change mid-flight, then reconstruct', () => {
  it('prevents execution after a revocation and shows the denied decision and the permission state it relied on', async () => {
    const user = userEvent.setup()
    await open(`#/workforce/${workerId('Payments-Disburse-003')}`)
    const drawer = await screen.findByRole('dialog', { name: 'Payments-Disburse-003' })
    expect(within(drawer).getByText(/Active · limit \$500,000/)).toBeInTheDocument()

    await user.click(within(drawer).getByRole('button', { name: 'Change permissions' }))
    const dialog = await screen.findByRole('dialog', { name: 'Change permissions' })
    await user.click(within(dialog).getByRole('radio', { name: 'Revoke' }))
    await user.type(within(dialog).getByLabelText('Reason'), 'Beneficiary flagged')
    await user.click(within(dialog).getByRole('button', { name: 'Revoke' }))

    await goTo('#/governance/op-c1')
    await user.click(await screen.findByRole('button', { name: 'Run execution step' }))

    expect(await screen.findByText(/Authorization was not valid when the action was attempted/)).toBeInTheDocument()
    expect(screen.getAllByText('Authorization denied').length).toBeGreaterThan(0)
    expect(screen.getByText('Execution prevented')).toBeInTheDocument()
    expect(screen.getByText('Matches')).toBeInTheDocument()
    expect(screen.getAllByText('Revoked').length).toBeGreaterThan(0)
  })

  it('allows execution when permission is still valid at the moment of execution', async () => {
    const user = userEvent.setup()
    await open('#/governance/op-c1')
    await user.click(await screen.findByRole('button', { name: 'Run execution step' }))
    expect((await screen.findAllByText(/Authorization was valid when the action ran/)).length).toBeGreaterThan(0)
    expect(screen.getByText('Operation executed')).toBeInTheDocument()
  })

  it('reconstructs a historical state: later revocation does not change an earlier executed outcome', async () => {
    await open('#/governance/op-d2')
    expect(await screen.findByText(/Authorization was valid when the action ran/)).toBeInTheDocument()
    expect(screen.getAllByText('Authorization allowed').length).toBeGreaterThan(0)
    expect(screen.getByText('Recorded after the outcome. It does not change it.')).toBeInTheDocument()
    expect(screen.getByText('Matches')).toBeInTheDocument()
  })

  it('shows a limit-exceeded denial with the lowered limit as evidence', async () => {
    await open('#/governance/op-d3')
    expect(await screen.findByText('The amount exceeds the permitted limit', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.getByText(/Active · limit \$100,000/, { selector: 'dd' })).toBeInTheDocument()
  })
})
