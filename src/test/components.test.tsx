import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Sidebar } from '../components/Sidebar';
import { PipelineDashboard } from '../components/PipelineDashboard';
import { mockMGAs } from '../data/mockData';

describe('UI Components Render Tests', () => {
  it('renders sidebar with Newport MGA brand and Lovell Minnick sponsor', () => {
    render(
      <Sidebar
        currentTab="pipeline"
        setCurrentTab={() => {}}
        pipelineCount={4}
        acquiredCount={4}
        synergyCount={5}
        jakesCount={14}
      />
    );

    expect(screen.getByText('NEWPORT')).toBeInTheDocument();
    expect(screen.getByText('Sponsor: Lovell Minnick')).toBeInTheDocument();
    expect(screen.getByText('M&A Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Aggregated Portfolio')).toBeInTheDocument();
  });

  it('renders pipeline dashboard with Best-in-Class filter and KPI metrics', () => {
    render(
      <PipelineDashboard
        mgas={mockMGAs}
        onSelectMGA={() => {}}
        onAddMGAClick={() => {}}
        onAcquireMGA={() => {}}
      />
    );

    expect(screen.getByText('M&A Acquisition Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Active Pipeline Targets')).toBeInTheDocument();
    expect(screen.getByText('Aggregated Target EBITDA')).toBeInTheDocument();
    expect(screen.getByText(/Best in Class/i)).toBeInTheDocument();
  });
});
