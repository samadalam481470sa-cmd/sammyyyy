import React, { useState } from 'react';
import { MGA, GeographicRegion, LineOfBusiness } from '../types';
import { X, Plus, Building2, DollarSign, Calendar, MapPin, Award } from 'lucide-react';

interface AddMGAModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMGA: (newMGA: MGA) => void;
}

export const AddMGAModal: React.FC<AddMGAModalProps> = ({
  isOpen,
  onClose,
  onAddMGA,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [yearsExp, setYearsExp] = useState(25);
  const [region, setRegion] = useState<GeographicRegion>('Northeast');
  const [lob, setLOB] = useState<LineOfBusiness>('Specialty Casualty');
  const [ebitda2025, setEbitda2025] = useState(5000000);
  const [growthPct, setGrowthPct] = useState(22.5);
  const [gwp, setGwp] = useState(35000000);
  const [description, setDescription] = useState('');
  const [thesis, setThesis] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const generatedCode = code.trim() || name.substring(0, 4).toUpperCase();
    const currentYear = new Date().getFullYear();
    const foundedYear = currentYear - yearsExp;

    const newMGA: MGA = {
      id: `mga-custom-${Date.now()}`,
      name: name.trim(),
      legal_name: `${name.trim()} Agency, LLC`,
      code: generatedCode,
      founded_year: foundedYear,
      years_of_experience: Number(yearsExp),
      status: 'Pipeline',
      pipeline_stage: 'Initial Screening',
      headquarters: {
        city: 'New York',
        state: 'NY',
        region: region,
        address: '100 Park Avenue, Suite 1200',
      },
      primary_region: region,
      primary_lob: lob,
      description: description || `Specialty ${lob} MGA with extensive underwriting history across ${region}.`,
      investment_thesis: thesis || `Strong strategic fit to expand ${lob} roll-up capabilities.`,
      website: `https://${generatedCode.toLowerCase()}-underwriting.example.com`,
      contact_name: 'Managing Principal',
      contact_role: 'Founder & CEO',
      contact_email: `contact@${generatedCode.toLowerCase()}.example.com`,
      valuation_multiple: 10.0,
      target_enterprise_value: ebitda2025 * 10.0,
      rating_score: 90,
      key_carrier_partners: ['Munich Re Specialty', "Lloyd's of London"],
      tags: [lob, `${yearsExp}+ Yrs Track Record`, 'Pipeline Target'],
      leadership: [
        { name: 'Lead Underwriting Principal', title: 'Managing Director', email: 'director@example.com', yearsInIndustry: yearsExp }
      ],
      financials: [
        {
          fiscal_year: 2024,
          historical_ebitda: ebitda2025 / (1 + growthPct / 100),
          gross_written_premium: gwp * 0.85,
          revenue: (ebitda2025 / (1 + growthPct / 100)) / 0.3,
          ebitda_margin_pct: 30.0,
          yoy_ebitda_growth_pct: 18.0,
          loss_ratio_pct: 48.0,
          bad_debt_loss_rate: 0.2,
        },
        {
          fiscal_year: 2025,
          historical_ebitda: Number(ebitda2025),
          gross_written_premium: Number(gwp),
          revenue: Number(ebitda2025) / 0.32,
          ebitda_margin_pct: 32.0,
          yoy_ebitda_growth_pct: Number(growthPct),
          loss_ratio_pct: 46.5,
          bad_debt_loss_rate: 0.2,
        },
      ],
      programs: [
        {
          id: `prog-${Date.now()}`,
          mga_id: `mga-custom-${Date.now()}`,
          program_name: `${name} Primary Program`,
          line_of_business: lob,
          coverage_type: 'Primary General Liability',
          geographic_region: region,
          carrier_partner: 'Munich Re Specialty',
          carrier_rating: 'A+ (Superior)',
          annual_gwp: Number(gwp),
          average_commission_rate: 15.0,
          underwriting_authority_limit: 15000000,
          target_industry: 'Commercial Specialty',
          active_policies: 450,
        }
      ],
      retail_agencies: [
        {
          id: `jake-${Date.now()}`,
          associated_mga_id: `mga-custom-${Date.now()}`,
          agency_name: `Jake Commercial Brokerage for ${name}`,
          principal_agent: 'Jake Anderson, CIC',
          email: 'janderson@jakebrokerage.example.com',
          phone: '(212) 555-9011',
          city: 'New York',
          state: 'NY',
          region: region,
          annual_placed_premium: 3500000,
          active_policies_count: 80,
          tier: 'Platinum',
          primary_lines_placed: [lob],
          years_partnered: 12,
        }
      ]
    };

    onAddMGA(newMGA);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-sky-400" />
            <h2 className="text-base font-bold text-white">Add Prospective Target MGA</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">MGA Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Liberty Specialty Underwriting"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Ticker / TLA Code</label>
              <input
                type="text"
                maxLength={5}
                placeholder="e.g. LSU"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500 font-mono uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Years of Experience (20-30+ Yrs)</label>
              <input
                type="number"
                min="1"
                max="60"
                value={yearsExp}
                onChange={(e) => setYearsExp(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Geographic Region</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500"
              >
                <option value="Northeast">Northeast</option>
                <option value="Southeast">Southeast</option>
                <option value="Midwest">Midwest</option>
                <option value="West / Pacific">West / Pacific</option>
                <option value="Southwest">Southwest</option>
                <option value="National">National</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Line of Business (LOB)</label>
              <select
                value={lob}
                onChange={(e) => setLOB(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500"
              >
                <option value="Specialty Casualty">Specialty Casualty</option>
                <option value="Inland & Ocean Marine">Inland & Ocean Marine</option>
                <option value="Commercial Property">Commercial Property</option>
                <option value="Environmental & Energy">Environmental & Energy</option>
                <option value="Cyber Risk & Tech E&O">Cyber Risk & Tech E&O</option>
                <option value="Specialty Excess & Surplus (E&S)">Specialty Excess & Surplus (E&S)</option>
                <option value="Executive Liability / D&O">Executive Liability / D&O</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">2025 Run-Rate EBITDA ($)</label>
              <input
                type="number"
                step="100000"
                value={ebitda2025}
                onChange={(e) => setEbitda2025(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">YoY EBITDA Growth (%)</label>
              <input
                type="number"
                step="0.5"
                value={growthPct}
                onChange={(e) => setGrowthPct(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Gross Written Premium ($)</label>
              <input
                type="number"
                step="500000"
                value={gwp}
                onChange={(e) => setGwp(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Lovell Minnick Investment Thesis</label>
            <textarea
              rows={2}
              placeholder="Strategic rationale for rolling this MGA into Newport Specialty Partners..."
              value={thesis}
              onChange={(e) => setThesis(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg shadow-md transition-all flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Save to Pipeline
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
