import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../src/App'
import { createInitialState } from '../src/data/generate'
import { buildRoi, companyReturn, reviewList } from '../src/domain/roi'

const seed = createInitialState()
const model = buildRoi(seed)

async function open(hash: string) {
  window.location.hash = hash
  return render(<App />)
}

describe('return on cost in the System', () => {
  it('Start here leads with the verified return, the colour counts in words, and who to review', async () => {
    await open('#/overview')
    const c = companyReturn(seed, model)
    const card = (await screen.findByRole('heading', { name: 'Is the AI spend justified?' })).closest('section')!
    const q = within(card)
    expect(q.getByText(/verified return on AI spend/)).toBeInTheDocument()
    for (const word of ['Pays off', 'Thin or unproven', 'Not paying off', 'No evidence']) expect(q.getAllByText(word).length).toBeGreaterThan(0)
    expect(q.getByText(`$${Math.round(c.unprovenCost).toLocaleString('en-US')}`)).toBeInTheDocument()
    expect(q.getByRole('button', { name: 'See who to review' })).toBeInTheDocument()
  })

  it('"See who to review" opens the Registry on red and amber, and lets you pause the ones not paying off', async () => {
    const user = userEvent.setup()
    await open('#/overview')
    await user.click(await screen.findByRole('button', { name: 'See who to review' }))
    const select = await screen.findByRole('combobox', { name: 'Return' })
    expect(select).toHaveValue('attention')

    const red = reviewList(seed, model, ['red'])
    const bar = await screen.findByRole('form', { name: /Pause the workers that are not paying off/ })
    expect(within(bar).getByRole('button', { name: `Pause ${red.length} workers` })).toBeInTheDocument()
    await user.click(within(bar).getByRole('button', { name: `Pause ${red.length} workers` }))
    // the red set is gone from the data, so the bar disappears
    await waitFor(() => expect(screen.queryByRole('form', { name: /Pause the workers that are not paying off/ })).not.toBeInTheDocument())
  })

  it('a worker profile shows the return, a plain verdict, the suggested action and the unconfirmed potential apart', async () => {
    const user = userEvent.setup()
    await open('#/workforce/registry%3Ared')
    const rows = await screen.findAllByRole('row')
    await user.click(rows[1])
    const block = await screen.findByRole('region', { name: 'Return on cost' })
    expect(within(block).getByText(/Not paying off/)).toBeInTheDocument()
    expect(within(block).getByText('Pause or fix')).toBeInTheDocument()
    expect(within(block).getByText('Potential, unconfirmed')).toBeInTheDocument()
    expect(within(block).getByText(/never counted/)).toBeInTheDocument()
  })

  it('a person shows the return of what they run, not a return of their own', async () => {
    const user = userEvent.setup()
    await open('#/workforce/registry')
    await user.click(await screen.findByRole('button', { name: 'People' }))
    const rows = await screen.findAllByRole('row')
    const row = rows.find((r) => /AI workers they own/.test(r.textContent ?? ''))!
    await user.click(row)
    const block = await screen.findByRole('region', { name: 'Return of what they run' })
    expect(within(block).getByText(/no value records of their own/)).toBeInTheDocument()
  })
})
