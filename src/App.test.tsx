import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('Newport portfolio CRM', () => {
  it('switches from portfolio overview to the acquisition pipeline', () => {
    render(<App />)
    expect(screen.getByText('Good evening, Mary.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /M&A pipeline/i }))
    expect(screen.getByRole('heading', { name: 'M&A pipeline' })).toBeInTheDocument()
    expect(screen.getByText('Pinnacle Risk Partners')).toBeInTheDocument()
  })

  it('filters pipeline targets by best-in-class metrics and region', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /M&A pipeline/i }))
    fireEvent.click(screen.getByRole('button', { name: /Best in class/i }))

    expect(screen.getByText('Pinnacle Risk Partners')).toBeInTheDocument()
    expect(screen.getByText('Great Lakes MGA')).toBeInTheDocument()
    expect(screen.queryByText('Cypress Specialty')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Region'), { target: { value: 'Midwest' } })
    expect(screen.getByText('Great Lakes MGA')).toBeInTheDocument()
    expect(screen.queryByText('Pinnacle Risk Partners')).not.toBeInTheDocument()
    expect(screen.getByText('Showing 1 of 4 active targets')).toBeInTheDocument()
  })
})
