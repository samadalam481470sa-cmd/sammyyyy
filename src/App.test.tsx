import type { PropsWithChildren } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('recharts', () => {
  const Chart = ({ children }: PropsWithChildren) => <div>{children}</div>
  return {
    ResponsiveContainer: Chart, PieChart: Chart, Pie: Chart, Cell: Chart, Tooltip: Chart,
    BarChart: Chart, Bar: Chart, CartesianGrid: Chart, XAxis: Chart, YAxis: Chart,
  }
})

afterEach(cleanup)

describe('Newport acquisition dashboard', () => {
  it('filters opportunities by status and clears filters', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Pending Deals' }))
    const table = screen.getByRole('table')
    expect(within(table).getByText('Project Cobalt')).toBeInTheDocument()
    expect(within(table).queryByText('Project Guardian')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Clear filters/i }))
    expect(within(table).getByText('Project Guardian')).toBeInTheDocument()
  })

  it('filters the priority table by pipeline stage', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'NDA' }))
    const table = screen.getByRole('table')
    expect(within(table).getByText('Project Guardian')).toBeInTheDocument()
    expect(within(table).queryByText('Project Jugular')).not.toBeInTheDocument()
  })

  it('searches project and entity names', () => {
    render(<App />)

    fireEvent.change(screen.getByLabelText('Search opportunities'), { target: { value: 'Orion' } })
    const table = screen.getByRole('table')
    expect(within(table).getByText('Project Jugular')).toBeInTheDocument()
    expect(within(table).queryByText('Project Guardian')).not.toBeInTheDocument()
  })

  it('shows only attention-required opportunities', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Needs Attention' }))
    const table = screen.getByRole('table')
    expect(within(table).getByText('Project Guardian')).toBeInTheDocument()
    expect(within(table).getByText('Project Summit')).toBeInTheDocument()
    expect(within(table).queryByText('Project Jugular')).not.toBeInTheDocument()
  })

  it('opens an opportunity detail drawer', () => {
    render(<App />)

    fireEvent.click(within(screen.getByRole('table')).getByText('Project Guardian'))
    const dialog = screen.getByRole('dialog', { name: 'Project Guardian' })
    expect(within(dialog).getByText('CrossCover Insurance Services')).toBeInTheDocument()
    expect(within(dialog).getByText('Review initial materials')).toBeInTheDocument()
    expect(within(dialog).getByText('Full Opportunity Profile')).toBeInTheDocument()
  })
})
