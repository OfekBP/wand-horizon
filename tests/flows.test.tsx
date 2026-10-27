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
    // inline in the drawer: no modal for a task that needs no interruption
    const form = await within(drawer).findByRole('form', { name: 'Reassign pending decision' })
    await user.selectOptions(within(form).getByLabelText('New approver'), workerId('Ingrid Novak'))
    await user.type(within(form).getByLabelText('Reason'), 'Elena is out of office')
    await user.click(within(form).getByRole('button', { name: 'Confirm reassignment' }))

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
    // the map's situation panel docks beside the map instead of opening a drawer
    const drawer = await screen.findByRole('complementary', { name: 'Situation' })
    expect(within(drawer).getByText(/Active · limit \$500,000/)).toBeInTheDocument()

    await user.click(within(drawer).getByRole('button', { name: 'Change permissions' }))
    const dialog = await screen.findByRole('dialog', { name: 'Change permissions' })
    await user.click(within(dialog).getByRole('radio', { name: 'Revoke' }))
    await user.type(within(dialog).getByLabelText('Reason'), 'Beneficiary flagged')
    await user.click(within(dialog).getByRole('button', { name: 'Revoke' }))

    await goTo('#/governance/op-c1')
    await user.click(await screen.findByRole('button', { name: 'Run execution step' }))

    expect(await screen.findByText(/The action did not run\./)).toBeInTheDocument()
    expect((await screen.findAllByText('Denied')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Authorization denied').length).toBeGreaterThan(0)
    expect(screen.getByText('Execution prevented')).toBeInTheDocument()
    expect(screen.getByText('Verified')).toBeInTheDocument()
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
    expect(await screen.findByText(/The action ran\./)).toBeInTheDocument()
    expect(screen.getAllByText('Authorization allowed').length).toBeGreaterThan(0)
    expect(screen.getByText('Recorded after the outcome. It does not change it.')).toBeInTheDocument()
    expect(screen.getByText('Verified')).toBeInTheDocument()
    // then versus now: stored as allowed, and the later revocation is named but does not rewrite it
    expect(screen.getByText('This decision stands.')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Then and now' })).toHaveTextContent('would be denied')
  })

  it('shows a limit-exceeded denial with the lowered limit as evidence', async () => {
    await open('#/governance/op-d3')
    expect((await screen.findAllByText('The amount exceeds the permitted limit')).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Active · limit \$100,000/).length).toBeGreaterThan(0)
  })
})

describe('One-page mid-flight story and the cost row', () => {
  it('lets the case page change the permission, then run the step, and be prevented', async () => {
    const user = userEvent.setup()
    await open('#/governance/op-c1')
    await user.click(await screen.findByRole('button', { name: 'Change permissions' }))
    const dialog = await screen.findByRole('dialog', { name: 'Change permissions' })
    await user.click(within(dialog).getByRole('radio', { name: 'Revoke' }))
    await user.type(within(dialog).getByLabelText('Reason'), 'Vendor under sanctions review')
    await user.click(within(dialog).getByRole('button', { name: 'Revoke' }))
    await user.click(await screen.findByRole('button', { name: 'Run execution step' }))
    expect(await screen.findByText(/The action did not run\./)).toBeInTheDocument()
    expect(screen.getByText('Execution prevented')).toBeInTheDocument()
  })

  it('shows spend without proof on the Overview and opens it on the map', async () => {
    const user = userEvent.setup()
    await open('#/overview')
    const row = await screen.findByRole('button', { name: /Investigate Clear the Q4 claims backlog/ })
    expect(screen.getByText(/Spend without proof/)).toBeInTheDocument()
    await user.click(row)
    expect(await screen.findByRole('complementary', { name: 'Situation' })).toHaveTextContent(/none with verified value/)
  })
})

describe('One product, two missions', () => {
  it('Overview shows permissions changed after work started and moves when a permission is revoked mid-flight', async () => {
    const user = userEvent.setup()
    await open('#/overview')
    expect(await screen.findByText('Permission changed after work started · 1')).toBeInTheDocument()

    await goTo(`#/workforce/${workerId('Payments-Disburse-003')}`)
    // the map's situation panel docks beside the map instead of opening a drawer
    const drawer = await screen.findByRole('complementary', { name: 'Situation' })
    await user.click(within(drawer).getByRole('button', { name: 'Change permissions' }))
    const dialog = await screen.findByRole('dialog', { name: 'Change permissions' })
    await user.click(within(dialog).getByRole('radio', { name: 'Revoke' }))
    await user.type(within(dialog).getByLabelText('Reason'), 'Beneficiary flagged')
    await user.click(within(dialog).getByRole('button', { name: 'Revoke' }))

    await goTo('#/overview')
    expect(await screen.findByText('Permission changed after work started · 2')).toBeInTheDocument()
  })

  it('a case keeps its thread: from the Overview into evidence and back', async () => {
    const user = userEvent.setup()
    await open('#/overview')
    await user.click(await screen.findByRole('button', { name: /Open the evidence for Post ledger adjustment ADJ-4417/ }))
    expect(await screen.findByRole('heading', { name: /ADJ-4417/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back to Start here' }))
    expect(await screen.findByText('Permission changed after work started · 1')).toBeInTheDocument()
  })

  it('opens on three plain questions that lead into both missions', async () => {
    const user = userEvent.setup()
    await open('#/overview')
    expect(await screen.findByRole('heading', { name: 'Is anything stuck?' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Is the AI spend justified?' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'What was the AI allowed to do?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Replay a past incident' }))
    expect(await screen.findByText('Incident replay')).toBeInTheDocument()
  })

  it('the first-run strip can be dismissed and stays dismissed', async () => {
    const user = userEvent.setup()
    await open('#/overview')
    expect(await screen.findByText(/New here\?/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText(/New here\?/)).not.toBeInTheDocument()
    expect(window.localStorage.getItem('wh-firstrun-dismissed')).toBe('1')
  })

  it('Governance opens on the cases where authority changed, not on a flat list', async () => {
    await open('#/governance')
    expect(await screen.findByRole('button', { name: /Authority changed/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByText(/Wire \$120,000 to Northwind Escrow/).length).toBeGreaterThan(0)
  })
})
