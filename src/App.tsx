import { useMemo, useState } from 'react'
import {
  ArrowDown, ArrowUpRight, BarChart3, Bell, BriefcaseBusiness, Building2,
  Check, ChevronDown, CircleDollarSign, Filter, LayoutDashboard, Map,
  Menu, Network, Plus, Search, Settings, SlidersHorizontal, Sparkles, Users, X,
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import { MGA, mgas } from './data'

type View = 'portfolio' | 'pipeline'
const money = (value: number) => `$${value.toFixed(1)}M`

function Logo() {
  return (
    <div className="logo">
      <div className="logo-mark"><span /><span /><span /></div>
      <div><b>NEWPORT</b><small>SPECIALTY PARTNERS</small></div>
    </div>
  )
}

function Sidebar({ view, setView, open, close }: {
  view: View; setView: (view: View) => void; open: boolean; close: () => void
}) {
  const select = (next: View) => { setView(next); close() }
  return (
    <>
      {open && <button className="scrim" onClick={close} aria-label="Close navigation" />}
      <aside className={open ? 'sidebar open' : 'sidebar'}>
        <Logo />
        <nav>
          <p>WORKSPACE</p>
          <button className={view === 'portfolio' ? 'active' : ''} onClick={() => select('portfolio')}>
            <LayoutDashboard size={18} /> Portfolio overview
          </button>
          <button className={view === 'pipeline' ? 'active' : ''} onClick={() => select('pipeline')}>
            <BriefcaseBusiness size={18} /> M&amp;A pipeline <span className="nav-count">4</span>
          </button>
          <button><Building2 size={18} /> All MGAs</button>
          <button><Users size={18} /> Retail agencies</button>
          <p>INTELLIGENCE</p>
          <button><Network size={18} /> Synergy map</button>
          <button><BarChart3 size={18} /> Financials</button>
          <button><Map size={18} /> Market coverage</button>
        </nav>
        <div className="sidebar-bottom">
          <button><Settings size={18} /> Settings</button>
          <div className="user"><span>MC</span><div><b>Mary Collins</b><small>Corporate Development</small></div><ChevronDown size={16} /></div>
        </div>
      </aside>
    </>
  )
}

function Header({ view, menu }: { view: View; menu: () => void }) {
  return (
    <header>
      <button className="menu-button" onClick={menu} aria-label="Open navigation"><Menu /></button>
      <div className="crumb">Newport <span>/</span> {view === 'portfolio' ? 'Portfolio overview' : 'M&A pipeline'}</div>
      <div className="header-actions">
        <label className="global-search"><Search size={17} /><input placeholder="Search portfolio..." /><kbd>⌘ K</kbd></label>
        <button className="icon-button" aria-label="Notifications"><Bell size={19} /><i /></button>
        <button className="primary-button"><Plus size={17} /> Add MGA</button>
      </div>
    </header>
  )
}

function MetricCard({ icon, label, value, detail, accent }: {
  icon: React.ReactNode; label: string; value: string; detail: string; accent: string
}) {
  return (
    <div className="metric-card">
      <div className="metric-head"><span className="metric-icon" style={{ background: `${accent}18`, color: accent }}>{icon}</span><ArrowUpRight size={17} /></div>
      <p>{label}</p><strong>{value}</strong><small><span>↑</span> {detail}</small>
    </div>
  )
}

const synergyData = [
  { name: 'Professional', value: 2 }, { name: 'Cyber', value: 2 },
  { name: 'Property', value: 2 }, { name: 'Marine', value: 1 },
  { name: 'Transport', value: 1 }, { name: 'Workers Comp', value: 1 },
]

function Portfolio() {
  const acquired = mgas.filter((mga) => mga.status === 'On Platform')
  const totalEbitda = acquired.reduce((sum, mga) => sum + mga.ebitda, 0)
  const trend = [2022, 2023, 2024, 2025].map((year) => ({
    year: String(year),
    ebitda: acquired.reduce((sum, mga) => sum + (mga.financials.find((item) => item.year === year)?.ebitda ?? 0), 0),
  }))
  return (
    <main>
      <div className="page-title">
        <div><p>PORTFOLIO INTELLIGENCE</p><h1>Good evening, Mary.</h1><span>Here’s how the Newport portfolio is performing.</span></div>
        <div className="updated"><i /> Data refreshed 12 min ago</div>
      </div>
      <section className="metrics">
        <MetricCard icon={<Building2 size={20} />} label="MGAs on platform" value="4" detail="1 added this quarter" accent="#0c7369" />
        <MetricCard icon={<CircleDollarSign size={20} />} label="Combined EBITDA" value={money(totalEbitda)} detail="16.8% year over year" accent="#bd7b2b" />
        <MetricCard icon={<Users size={20} />} label="Retail agency network" value="140" detail="12.4% year over year" accent="#586aa5" />
        <MetricCard icon={<Sparkles size={20} />} label="Synergies identified" value="7" detail="$4.2M potential impact" accent="#9a5d88" />
      </section>
      <section className="dashboard-grid">
        <article className="panel performance-panel">
          <div className="panel-title"><div><p>PORTFOLIO PERFORMANCE</p><h2>EBITDA growth</h2></div><button>Last 4 years <ChevronDown size={15} /></button></div>
          <div className="chart-summary"><strong>{money(totalEbitda)}</strong><span>+16.8%</span><small>FY 2025 combined</small></div>
          <div className="area-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 8, right: 8, left: -25, bottom: 0 }}>
                <defs><linearGradient id="ebitda" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#14796f" stopOpacity=".24" /><stop offset="100%" stopColor="#14796f" stopOpacity="0" /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="#e8ece9" />
                <XAxis dataKey="year" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => `$${v}M`} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => money(Number(v))} />
                <Area type="monotone" dataKey="ebitda" stroke="#14796f" strokeWidth={3} fill="url(#ebitda)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="panel synergy-panel">
          <div className="panel-title"><div><p>SYNERGY SIGNALS</p><h2>Portfolio overlaps</h2></div><button className="text-button">View map <ArrowUpRight size={15} /></button></div>
          <div className="bar-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={synergyData} layout="vertical" margin={{ left: 0, right: 10 }}>
                <XAxis type="number" hide domain={[0, 3]} /><YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={90} />
                <Tooltip cursor={{ fill: '#f4f6f4' }} />
                <Bar dataKey="value" radius={[0, 5, 5, 0]} barSize={12}>
                  {synergyData.map((_, index) => <Cell key={index} fill={index < 3 ? '#16796f' : '#b9c9c5'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="insight"><Sparkles size={17} /><p><b>3 high-confidence overlaps</b><span>Cross-sell potential across 76 agencies</span></p><ArrowUpRight size={16} /></div>
        </article>
      </section>
      <section className="panel platform-list">
        <div className="panel-title"><div><p>THE ONE PLATFORM</p><h2>Acquired MGAs</h2></div><button className="text-button">View all MGAs <ArrowUpRight size={15} /></button></div>
        <div className="table-wrap"><table>
          <thead><tr><th>MGA</th><th>CORE LINES</th><th>REGION</th><th>EXPERIENCE</th><th>EBITDA</th><th>YOY GROWTH</th><th>AGENCIES</th><th /></tr></thead>
          <tbody>{acquired.map((mga) => <MGArow key={mga.id} mga={mga} />)}</tbody>
        </table></div>
      </section>
    </main>
  )
}

function MGArow({ mga }: { mga: MGA }) {
  return (
    <tr>
      <td><div className="mga-name"><span>{mga.initials}</span><div><b>{mga.name}</b><small>{mga.location}</small></div></div></td>
      <td><div className="tags">{mga.lines.map((line) => <em key={line}>{line}</em>)}</div></td>
      <td>{mga.region}</td><td>{mga.experience} years</td><td><b>{money(mga.ebitda)}</b></td>
      <td><span className="growth">↑ {mga.growth}%</span></td><td>{mga.agencies}</td><td><ArrowUpRight size={17} /></td>
    </tr>
  )
}

function Pipeline() {
  const [query, setQuery] = useState('')
  const [region, setRegion] = useState('All regions')
  const [bestOnly, setBestOnly] = useState(false)
  const [sort, setSort] = useState<'growth' | 'ebitda'>('growth')
  const prospects = useMemo(() => mgas
    .filter((mga) => mga.status === 'Prospect')
    .filter((mga) => `${mga.name} ${mga.lines.join(' ')}`.toLowerCase().includes(query.toLowerCase()))
    .filter((mga) => region === 'All regions' || mga.region === region)
    .filter((mga) => !bestOnly || (mga.experience >= 20 && mga.growth >= 15))
    .sort((a, b) => b[sort] - a[sort]), [query, region, bestOnly, sort])
  return (
    <main>
      <div className="page-title">
        <div><p>CORPORATE DEVELOPMENT</p><h1>M&amp;A pipeline</h1><span>Prioritize best-in-class MGA acquisition opportunities.</span></div>
        <button className="secondary-button"><SlidersHorizontal size={17} /> Customize view</button>
      </div>
      <section className="pipeline-stats">
        <div><span>ACTIVE TARGETS</span><strong>4</strong><small>Across 4 regions</small></div>
        <div><span>PIPELINE EBITDA</span><strong>$31.0M</strong><small><i>↑ 18.7%</i> avg. growth</small></div>
        <div><span>IN DILIGENCE / LOI</span><strong>2</strong><small>$18.6M combined EBITDA</small></div>
        <div><span>20+ YEARS EXPERIENCE</span><strong>3</strong><small>75% of pipeline</small></div>
      </section>
      <section className="panel pipeline-panel">
        <div className="pipeline-toolbar">
          <label className="table-search"><Search size={17} /><input aria-label="Search targets" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search targets or lines..." />{query && <button onClick={() => setQuery('')}><X size={14} /></button>}</label>
          <div className="filters">
            <label><Map size={16} /><select aria-label="Region" value={region} onChange={(e) => setRegion(e.target.value)}><option>All regions</option><option>Northeast</option><option>Southeast</option><option>Midwest</option><option>West</option></select><ChevronDown size={14} /></label>
            <button className={bestOnly ? 'filter active' : 'filter'} onClick={() => setBestOnly(!bestOnly)}><Sparkles size={16} /> Best in class {bestOnly && <Check size={14} />}</button>
            <button className="filter" onClick={() => setSort(sort === 'growth' ? 'ebitda' : 'growth')}><Filter size={16} /> Sort: {sort === 'growth' ? 'Growth' : 'EBITDA'} <ArrowDown size={14} /></button>
          </div>
        </div>
        <div className="pipeline-list">
          {prospects.map((mga, index) => (
            <div className="target-card" key={mga.id}>
              <div className="rank">0{index + 1}</div>
              <div className="mga-name"><span>{mga.initials}</span><div><b>{mga.name}</b><small>{mga.location} · {mga.experience} years</small></div></div>
              <div className="target-lines"><small>LINES OF BUSINESS</small><div className="tags">{mga.lines.map((line) => <em key={line}>{line}</em>)}</div></div>
              <div className="target-metric"><small>EBITDA</small><b>{money(mga.ebitda)}</b></div>
              <div className="target-metric"><small>YOY GROWTH</small><b className="growth">↑ {mga.growth}%</b></div>
              <div className="target-stage"><small>STAGE</small><span className={`stage ${mga.stage.toLowerCase().replace(' ', '-')}`}>{mga.stage}</span></div>
              <button className="open-target" aria-label={`Open ${mga.name}`}><ArrowUpRight size={18} /></button>
            </div>
          ))}
          {!prospects.length && <div className="empty-state"><Search size={28} /><h3>No targets found</h3><p>Try changing the search or filters.</p></div>}
        </div>
        <div className="pipeline-footer"><span>Showing {prospects.length} of 4 active targets</span><button><Plus size={15} /> Add acquisition target</button></div>
      </section>
    </main>
  )
}

export default function App() {
  const [view, setView] = useState<View>('portfolio')
  const [navOpen, setNavOpen] = useState(false)
  return (
    <div className="app-shell">
      <Sidebar view={view} setView={setView} open={navOpen} close={() => setNavOpen(false)} />
      <div className="content-shell">
        <Header view={view} menu={() => setNavOpen(true)} />
        {view === 'portfolio' ? <Portfolio /> : <Pipeline />}
      </div>
    </div>
  )
}
