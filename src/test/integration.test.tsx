import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { PortfolioView } from '../components/PortfolioView';
import { SchemaArchitectureView } from '../components/SchemaArchitectureView';
import { RetailAgenciesView } from '../components/RetailAgenciesView';
import { RollupSimulator } from '../components/RollupSimulator';
import { mockMGAs, mockSynergyOpportunities, mockRetailAgencies } from '../data/mockData';

describe('Integration Tests for Newport Specialty CRM Views', () => {
  it('renders Portfolio View with aggregated metrics and synergies', () => {
    render(
      <PortfolioView
        mgas={mockMGAs}
        synergies={mockSynergyOpportunities}
        onSelectMGA={() => {}}
      />
    );

    expect(screen.getByText(/Aggregated Portfolio/i)).toBeInTheDocument();
    expect(screen.getByText(/Lovell Minnick Master View/i)).toBeInTheDocument();
    expect(screen.getByText(/Identified Synergies/i)).toBeInTheDocument();
  });

  it('renders Schema Architecture View with Mary transcript checklist and DDL', () => {
    render(<SchemaArchitectureView />);

    expect(screen.getByText(/Database Schema & Platform Architecture/i)).toBeInTheDocument();
    expect(screen.getByText(/Visual ERD & Models/i)).toBeInTheDocument();
    expect(screen.getByText(/Mary Transcript Checklist/i)).toBeInTheDocument();
  });

  it('renders Retail Agencies ("The Jakes") directory with broker relationships', () => {
    render(
      <RetailAgenciesView
        retailAgencies={mockRetailAgencies}
        mgas={mockMGAs}
        onSelectMGA={() => {}}
      />
    );

    expect(screen.getByText(/Retail Agency Distribution/i)).toBeInTheDocument();
    expect(screen.getByText(/Jake Reynolds Marine Risk Brokers/i)).toBeInTheDocument();
  });

  it('renders Rollup Simulator with interactive what-if levers', () => {
    render(
      <RollupSimulator
        mgas={mockMGAs}
        onSelectMGA={() => {}}
      />
    );

    expect(screen.getByText(/M&A Roll-Up & Synergy Simulator/i)).toBeInTheDocument();
    expect(screen.getByText(/Pro-Forma Aggregated EBITDA/i)).toBeInTheDocument();
    expect(screen.getByText(/Simulation Levers/i)).toBeInTheDocument();
  });
});
