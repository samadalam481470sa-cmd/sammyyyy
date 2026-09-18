import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('Newport portfolio platform', () => {
  it('shows the portfolio overview with headline metrics', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Good afternoon, Mary.' })).toBeInTheDocument()
    expect(screen.getByText('Portfolio EBITDA')).toBeInTheDocument()
    expect(screen.getAllByText('$45.2M')).toHaveLength(2)
    expect(screen.getByText('Priority acquisition targets')).toBeInTheDocument()
  })

  it('filters pipeline targets by region and experience', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /M&A Pipeline/ }))
    expect(screen.getByRole('heading', { name: 'M&A Pipeline', level: 2 })).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Filter by region'), 'Pacific Northwest')
    const table = screen.getByRole('table')
    expect(within(table).getByText('Evergreen Specialty Markets')).toBeInTheDocument()
    expect(within(table).queryByText('Apex Program Administrators')).not.toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: '20+ years experience' }))
    expect(screen.getByText('No matching MGAs')).toBeInTheDocument()
  })

  it('opens the aggregated portfolio and shows synergy intelligence', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'One Platform' }))
    expect(screen.getByRole('heading', { name: 'One Platform', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('Highest-value synergies')).toBeInTheDocument()
    expect(screen.getByText('Mountain West + Southeast')).toBeInTheDocument()
    expect(screen.getAllByText('On Platform')).toHaveLength(4)
  })
})
