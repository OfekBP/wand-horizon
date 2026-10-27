import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../src/App'
import { createInitialState } from '../src/data/generate'
import { findings } from '../src/domain/findings'

const seed = createInitialState()
const workerId = (name: string) => seed.workers.find((w) => w.name === name)!.id

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
const panel = () => screen.findByRole('complementary', { name: 'Situation' })
const findingButton = (re: RegExp) => screen.findByRole('button', { name: re })

describe('Workforce map: see, understand, decide', () => {
  it('opens on the map with ranked findings, and keeps the registry as the alternative', async () => {
    const user = userEvent.setup()
    await open('#/workforce')
    expect(await screen.findByRole('group', { name: /Workforce map: 50 people and 500 AI workers/ })).toBeInTheDocument()
    const list = within(screen.getByRole('complementary', { name: 'What the map found' }))
    const findingButtons = () => list.getAllByRole('button').filter((b) => b.classList.contains('finding'))
    expect(findingButtons().length).toBe(findings(seed).length)
    expect(findingButtons()[0]).toHaveAccessibleName(/Blocked decision: Release settlement batch SB-2291/)

    await user.click(screen.getByRole('tab', { name: /Registry/ }))
    expect(await screen.findByRole('table', { name: 'Workforce registry' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /Workforce map/ })).not.toBeInTheDocument()
  })

  it('explains the blocked settlement: the person, why they cannot act, the deadline and the business consequence', async () => {
    const user = userEvent.setup()
    await open('#/workforce')
    await user.click(await findingButton(/Blocked decision: Release settlement batch SB-2291/))
    const p = within(await panel())
    expect(p.getByText(/Missing the custodian cut-off holds \$2,400,000/)).toBeInTheDocument()
    expect(p.getByText(/Elena Park \(Head of Treasury\) is out of office until Oct 31/)).toBeInTheDocument()
    expect(p.getByText(/Due Oct 27, 10:00 UTC, in 20h/)).toBeInTheDocument()
    // the map follows: the Blocked lens is selected
    expect(screen.getByRole('button', { name: 'Blocked' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('moving the blocked decision changes real state: the finding clears, the owner changes, the event is logged, and the operation stays awaiting approval', async () => {
    const user = userEvent.setup()
    await open('#/workforce/blocked%3Aop-a1')
    const p = within(await panel())
    const form = p.getByRole('form', { name: 'Reassign the blocked decision' })
    // only available people are offered
    expect(within(form).getAllByRole('radio').every((r) => !r.closest('label')!.textContent!.includes('Elena Park'))).toBe(true)
    await user.click(within(form).getAllByRole('radio')[0])
    await user.click(within(form).getByRole('button', { name: 'Move the decision' }))

    expect(await p.findByText(/Decision moved to/)).toBeInTheDocument()
    expect(p.getByText(/still awaiting approval/)).toBeInTheDocument()
    await user.click(p.getByRole('button', { name: 'Back to the findings' }))

    const list = within(await screen.findByRole('complementary', { name: 'What the map found' }))
    expect(list.queryByRole('button', { name: /Blocked decision/ })).not.toBeInTheDocument()
    expect(list.getAllByRole('button').filter((b) => b.classList.contains('finding'))).toHaveLength(findings(seed).length - 1)
    // the decision log shows the audit event it wrote
    expect(list.getByText('Pending decision reassigned')).toBeInTheDocument()

    // and the Work Queue still shows the operation as blocked, now with a different owner
    await goTo('#/queue/op-a1')
    const drawer = await screen.findByRole('dialog', { name: /SB-2291/ })
    expect(within(drawer).getByText('Awaiting approval')).toBeInTheDocument()
    expect(within(drawer).queryByText('Elena Park')).not.toBeInTheDocument()
  })

  it('resolving an objective conflict from the map closes the conflict everywhere', async () => {
    const user = userEvent.setup()
    await open('#/workforce/conflict%3Ac-001')
    const p = within(await panel())
    expect(p.getAllByText(/Pay suppliers early/).length).toBeGreaterThan(0)
    expect(p.getAllByText(/Minimize idle cash/).length).toBeGreaterThan(0)
    const form = p.getByRole('form', { name: 'Resolve the conflict' })
    await user.click(within(form).getByRole('radio', { name: /Liquidity-Forecast-005/ }))
    await user.type(within(form).getByLabelText('Resolution note'), 'Liquidity owns the buffer')
    await user.click(within(form).getByRole('button', { name: 'Resolve the conflict' }))
    expect(await p.findByText(/stands down/)).toBeInTheDocument()

    await goTo('#/queue')
    await user.click(await screen.findByRole('tab', { name: /Conflicts/ }))
    expect(screen.getByRole('tab', { name: /Conflicts/ })).toHaveTextContent('4')
  })

  it('pausing the unproven workers lowers the run-rate and logs one event', async () => {
    const user = userEvent.setup()
    await open('#/overview')
    await screen.findByText('Operating cost')
    const before = document.querySelector('.cost__amount')!.textContent
    await goTo('#/workforce/cost%3Am-claims')
    const p = within(await panel())
    expect(p.getByText(/simulated comparison/)).toBeInTheDocument()
    expect(p.getByText(/Both figures are modeled, not measured/)).toBeInTheDocument()
    await user.click(p.getByRole('button', { name: 'Pause 14 workers' }))
    expect(await p.findByText('14 workers paused')).toBeInTheDocument()

    await goTo('#/overview')
    await screen.findByText('Operating cost')
    const after = document.querySelector('.cost__amount')!.textContent
    expect(after).not.toBe(before)
    await goTo('#/governance')
    await user.click(await screen.findByRole('tab', { name: /Event log/ }))
    expect(await screen.findAllByText('14 AI workers paused')).not.toHaveLength(0)
  })

  it('selecting a person shows availability and what they are accountable for', async () => {
    await open(`#/workforce/${workerId('Elena Park')}`)
    const p = within(await panel())
    expect(p.getAllByText('Out of office').length).toBeGreaterThan(0)
    expect(p.getByText(/Owns or manages/)).toBeInTheDocument()
  })

  it('selecting a team and a mission shows summaries drawn from the same data', async () => {
    await open('#/workforce/m-claims')
    const p = within(await panel())
    expect(p.getByText('Clear the Q4 claims backlog')).toBeInTheDocument()
    expect(p.getByText(/0 verified/)).toBeInTheDocument()
    await goTo('#/workforce/t-treasury')
    expect(await within(await panel()).findByText('Treasury')).toBeInTheDocument()
    await waitFor(() => expect(within(screen.getByRole('complementary', { name: 'Situation' })).getByText(/Findings touching this team/)).toBeInTheDocument())
  })
})

describe('The map is connected to the rest of the product', () => {
  it('a blocked item on the Overview opens its finding on the map, and Back returns to the Overview', async () => {
    const user = userEvent.setup()
    await open('#/overview')
    await user.click(await screen.findByRole('button', { name: /Investigate Release settlement batch SB-2291/ }))
    const p = within(await panel())
    expect(p.getByText(/Missing the custodian cut-off holds \$2,400,000/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back to Overview' }))
    expect(await screen.findByText(/How the workforce is/)).toBeInTheDocument()
  })

  it('the Work Queue case drawer can show its operation on the map', async () => {
    const user = userEvent.setup()
    await open('#/queue/op-a1')
    const drawer = await screen.findByRole('dialog', { name: /SB-2291/ })
    await user.click(within(drawer).getByRole('button', { name: 'Show on the map' }))
    const p = within(await panel())
    expect(p.getByText(/is blocked because Elena Park is unavailable/)).toBeInTheDocument()
  })

  it('the rail counts the open findings, and the count follows the data', async () => {
    const user = userEvent.setup()
    await open('#/workforce/blocked%3Aop-a1')
    const rail = screen.getByRole('navigation', { name: 'Primary' })
    const before = Number(within(rail).getByTitle('Open findings on the workforce map').textContent)
    expect(before).toBe(findings(seed).length)
    const p = within(await panel())
    await user.click(within(p.getByRole('form', { name: 'Reassign the blocked decision' })).getAllByRole('radio')[0])
    await user.click(p.getByRole('button', { name: 'Move the decision' }))
    await p.findByText(/Decision moved to/)
    expect(Number(within(rail).getByTitle('Open findings on the workforce map').textContent)).toBe(before - 1)
  })

  it('a case page links back to the map for its worker and decision owner', async () => {
    const user = userEvent.setup()
    await open('#/governance/op-a1')
    await user.click(await screen.findByRole('button', { name: 'See it on the map' }))
    expect(await within(await panel()).findByText(/is blocked because Elena Park is unavailable/)).toBeInTheDocument()
  })
})