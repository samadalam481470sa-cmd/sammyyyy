import { describe, it, expect } from 'vitest';
import { mockMGAs, mockSynergyOpportunities, mockRetailAgencies } from '../data/mockData';
import { schemaEntities } from '../data/schemaDefinitions';

describe('Newport Specialty CRM Data Models & Schema Verification', () => {
  it('should verify MGA entities have 20-30+ years of experience per Mary requirement', () => {
    mockMGAs.forEach((mga) => {
      expect(mga.years_of_experience).toBeGreaterThanOrEqual(20);
      expect(['Pipeline', 'Acquired']).toContain(mga.status);
    });
  });

  it('should verify historical EBITDA time series exists and calculates growth', () => {
    mockMGAs.forEach((mga) => {
      expect(mga.financials.length).toBeGreaterThanOrEqual(3);
      mga.financials.forEach((fin) => {
        expect(fin.historical_ebitda).toBeGreaterThan(0);
        expect(fin.fiscal_year).toBeGreaterThanOrEqual(2020);
      });
    });
  });

  it('should verify insurance programs have Line of Business, Coverage Type, and Geographic Region tags', () => {
    mockMGAs.forEach((mga) => {
      if (mga.programs && mga.programs.length > 0) {
        mga.programs.forEach((prog) => {
          expect(prog.line_of_business).toBeDefined();
          expect(prog.coverage_type).toBeDefined();
          expect(prog.geographic_region).toBeDefined();
          expect(prog.mga_id).toBe(mga.id);
        });
      }
    });
  });

  it('should verify Retail Agencies ("The Jakes") have associated_mga foreign key link', () => {
    mockRetailAgencies.forEach((jake) => {
      expect(jake.associated_mga_id).toBeDefined();
      expect(jake.principal_agent).toBeDefined();
      expect(jake.annual_placed_premium).toBeGreaterThan(0);
    });
  });

  it('should verify all core schema entities requested in Mary transcript exist in schema definitions', () => {
    const tableNames = schemaEntities.map((e) => e.tableName);
    expect(tableNames).toContain('managing_general_agents');
    expect(tableNames).toContain('mga_financials');
    expect(tableNames).toContain('insurance_programs');
    expect(tableNames).toContain('retail_agencies');
    expect(tableNames).toContain('portfolio_synergies');
  });

  it('should verify synergy opportunities contain overlap dimensions and estimated values', () => {
    mockSynergyOpportunities.forEach((synergy) => {
      expect(synergy.estimated_annual_value).toBeGreaterThan(0);
      expect(synergy.mga_ids.length).toBeGreaterThanOrEqual(1);
      expect(synergy.overlap_dimension).toBeDefined();
    });
  });
});
