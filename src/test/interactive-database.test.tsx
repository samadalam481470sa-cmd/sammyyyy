import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { InteractiveDatabase } from '../components/InteractiveDatabase';
import { mockMGAs, mockSynergyOpportunities, mockRetailAgencies } from '../data/mockData';

describe('Interactive Database unified view', () => {
  it('renders all five joined tables and schema map', () => {
    render(
      <InteractiveDatabase
        mgas={mockMGAs}
        retailAgencies={mockRetailAgencies}
        synergies={mockSynergyOpportunities}
        onSelectMGA={() => {}}
      />
    );

    expect(screen.getByText(/Interactive Portfolio Database/i)).toBeInTheDocument();
    expect(screen.getAllByText('managing_general_agents').length).toBeGreaterThan(0);
    expect(screen.getAllByText('mga_financials').length).toBeGreaterThan(0);
    expect(screen.getAllByText('insurance_programs').length).toBeGreaterThan(0);
    expect(screen.getAllByText('retail_agencies').length).toBeGreaterThan(0);
    expect(screen.getAllByText('portfolio_synergies').length).toBeGreaterThan(0);
    expect(screen.getByText(/Relation Inspector/i)).toBeInTheDocument();
  });
});
