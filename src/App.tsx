import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  Building2,
  Check,
  ChevronDown,
  CircleHelp,
  Filter,
  Handshake,
  LayoutDashboard,
  MapPin,
  Menu,
  Network,
  Plus,
  Search,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatMoney, growth, latestEbitda, mgas, portfolio, prospects, type MGA } from './data'

type View = 'overview' | 'pipeline' | 'portfolio' | 'mgas' | 'agencies'
type Sort = 'growth' | 'ebitda' | 'experience'

const navItems: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'pipeline', label: 'M&A Pipeline', icon: BriefcaseBusiness },
  { id: 'portfolio', label: 'One Platform', icon: Network },
  { id: 'mgas', label: 'All MGAs', icon: Building2 },
  { id: 'agencies', label: 'Retail Network', icon: Users },
]

const aggregateHistory = [2022, 2023, 2024].map((year, index) => ({
  year,
  EBITDA: portfolio.reduce((sum, mga) => sum + mga.financials[index].ebitda, 0),
}))

function Logo() {
  return (
    <div className="logo">
      <div className="logo-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div>
        <strong>NEWPORT</strong>
        <small>SPECIALTY PARTNERS</small>
      </div>
    </div>
  )
}

function Sidebar({ active, onNavigate, open, close }: {
  active: View
  onNavigate: (view: View) => void
  open: boolean
  close: () => void
}) {
  return (
    <>
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="sidebar-head">
          <Logo />
          <button className="icon-button close-nav" onClick={close} aria-label="Close navigation"><X size={20} /></button>
        </div>
        <nav aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${active === id ? 'active' : ''}`}
              onClick={() => { onNavigate(id); close() }}
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{label}</span>
              {id === 'pipeline' && <em>{prospects.length}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item"><CircleHelp size={19} /><span>Help & resources</span></button>
          <button className="nav-item"><Settings size={19} /><span>Settings</span></button>
          <div className="user-card">
            <div className="avatar">MB</div>
            <div><strong>Mary Brooks</strong><small>Corporate Development</small></div>
            <ChevronDown size={16} />
          </div>
        </div>
      </aside>
      {open && <button className="nav-backdrop" onClick={close} aria-label="Close navigation overlay" />}
    </>
  )
}

function Header({ title, openNav }: { title: string; openNav: () => void }) {
  return (
    <header className="topbar">
      <div className="topbar-title">
        <button className="icon-button menu-button" onClick={openNav} aria-label="Open navigation"><Menu size={22} /></button>
        <div><span>Newport Specialty Partners</span><h1>{title}</h1></div>
      </div>
      <div className="header-actions">
        <label className="global-search">
          <Search size={17} />
          <input placeholder="Search portfolio…" aria-label="Search portfolio" />
          <kbd>⌘ K</kbd>
        </label>
        <button className="icon-button notification" aria-label="Notifications"><Bell size={19} /><i /></button>
        <div className="avatar small">MB</div>
      </div>
    </header>
  )
}

function StatCard({ label, value, note, icon: Icon, tone }: {
  label: string
  value: string
  note: string
  icon: typeof Building2
  tone: string
}) {
  return (
    <article className="stat-card">
      <div className={`stat-icon ${tone}`}><Icon size={20} /></div>
      <div className="stat-meta"><span>{label}</span><strong>{value}</strong></div>
      <div className="stat-note"><TrendingUp size={14} />{note}</div>
    </article>
  )
}

function SectionHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return (
    <div className="section-header">
      <div>{eyebrow && <span>{eyebrow}</span>}<h2>{title}</h2></div>
      {action}
    </div>
  )
}

function Overview({ navigate }: { navigate: (view: View) => void }) {
  const totalEbitda = portfolio.reduce((sum, mga) => sum + latestEbitda(mga), 0)
  return (
    <>
      <section className="hero-heading">
        <div>
          <p className="eyebrow">Friday, September 18</p>
          <h2>Good afternoon, Mary.</h2>
          <p>Here’s what’s happening across the Newport platform.</p>
        </div>
        <button className="primary-button" onClick={() => navigate('pipeline')}><Plus size={17} /> Add target MGA</button>
      </section>

      <section className="stats-grid" aria-label="Portfolio summary">
        <StatCard label="On-platform MGAs" value={String(portfolio.length)} note="2 added this year" icon={Building2} tone="blue" />
        <StatCard label="Portfolio EBITDA" value={formatMoney(totalEbitda)} note="19.4% year over year" icon={TrendingUp} tone="green" />
        <StatCard label="Retail agency reach" value={String(portfolio.reduce((sum, mga) => sum + mga.agencies, 0))} note="Across 8 regions" icon={Users} tone="gold" />
        <StatCard label="Active opportunities" value={String(prospects.length)} note={`${formatMoney(prospects.reduce((sum, mga) => sum + latestEbitda(mga), 0))} potential`} icon={Handshake} tone="rust" />
      </section>

      <section className="overview-grid">
        <article className="panel performance-panel">
          <SectionHeader
            eyebrow="Performance"
            title="Portfolio EBITDA growth"
            action={<button className="select-button">Last 3 years <ChevronDown size={15} /></button>}
          />
          <div className="chart-value">
            <strong>{formatMoney(totalEbitda)}</strong>
            <span><ArrowUp size={13} /> 19.4%</span>
            <small>FY 2024</small>
          </div>
          <div className="chart-wrap" aria-label="Portfolio EBITDA from 2022 to 2024">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={aggregateHistory} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="ebitdaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1f6678" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#1f6678" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#e9ece9" />
                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: '#78827d', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#78827d', fontSize: 12 }} tickFormatter={(v) => `$${v}M`} />
                <Tooltip formatter={(value) => [formatMoney(Number(value)), 'EBITDA']} />
                <Area type="monotone" dataKey="EBITDA" stroke="#1f6678" strokeWidth={2.5} fill="url(#ebitdaFill)" dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel focus-panel">
          <SectionHeader eyebrow="Intelligence" title="Synergy opportunities" action={<button className="text-button" onClick={() => navigate('portfolio')}>View all <ArrowUpRight size={15} /></button>} />
          <div className="focus-card">
            <div className="focus-icon"><Sparkles size={20} /></div>
            <div>
              <strong>Commercial Property</strong>
              <p>Shared across 2 MGAs with complementary regional reach.</p>
              <div className="mini-avatars"><span>SR</span><span>CS</span><small>High potential</small></div>
            </div>
          </div>
          <div className="focus-card">
            <div className="focus-icon muted"><MapPin size={20} /></div>
            <div>
              <strong>Mid-Atlantic expansion</strong>
              <p>Ironwood creates a strategic bridge into HarborPoint’s footprint.</p>
              <div className="mini-avatars"><span>HU</span><span className="prospect-avatar">II</span><small>Pipeline match</small></div>
            </div>
          </div>
          <div className="insight-note"><span>3</span><p>additional cross-sell opportunities identified from current program overlap.</p></div>
        </article>
      </section>

      <article className="panel">
        <SectionHeader
          eyebrow="Live pipeline"
          title="Priority acquisition targets"
          action={<button className="text-button" onClick={() => navigate('pipeline')}>View pipeline <ArrowUpRight size={15} /></button>}
        />
        <MfaTable items={prospects.slice(0, 3)} compact />
      </article>
    </>
  )
}

function StatusBadge({ stage }: { stage: MGA['stage'] }) {
  return <span className={`status-badge stage-${stage.toLowerCase().replaceAll(' ', '-')}`}><i />{stage}</span>
}

function MfaTable({ items, compact = false }: { items: MGA[]; compact?: boolean }) {
  return (
    <div className="table-scroll">
      <table>
        <thead><tr>
          <th>MGA</th>
          <th>Status</th>
          <th>Region</th>
          <th>Experience</th>
          <th>2024 EBITDA</th>
          <th>YoY growth</th>
          {!compact && <th>Retail agencies</th>}
          <th aria-label="Open record" />
        </tr></thead>
        <tbody>
          {items.map((mga) => (
            <tr key={mga.id}>
              <td><div className="company-cell"><span style={{ background: mga.accent }}>{mga.initials}</span><div><strong>{mga.name}</strong><small>{mga.headquarters}</small></div></div></td>
              <td><StatusBadge stage={mga.stage} /></td>
              <td>{mga.regions[0]}</td>
              <td>{mga.experience} years</td>
              <td className="money">{formatMoney(latestEbitda(mga))}</td>
              <td><span className="growth"><ArrowUp size={12} />{growth(mga).toFixed(1)}%</span></td>
              {!compact && <td>{mga.agencies}</td>}
              <td><button className="row-action" aria-label={`Open ${mga.name}`}><ArrowUpRight size={17} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Pipeline() {
  const [region, setRegion] = useState('All regions')
  const [onlyExperienced, setOnlyExperienced] = useState(false)
  const [sort, setSort] = useState<Sort>('growth')
  const regions = [...new Set(prospects.flatMap((mga) => mga.regions))]
  const filtered = useMemo(() => {
    const result = prospects.filter((mga) =>
      (region === 'All regions' || mga.regions.includes(region)) &&
      (!onlyExperienced || mga.experience >= 20)
    )
    return [...result].sort((a, b) => {
      if (sort === 'growth') return growth(b) - growth(a)
      if (sort === 'ebitda') return latestEbitda(b) - latestEbitda(a)
      return b.experience - a.experience
    })
  }, [region, onlyExperienced, sort])

  return (
    <>
      <section className="hero-heading page-heading">
        <div><p className="eyebrow">Corporate development</p><h2>M&A Pipeline</h2><p>Prioritize best-in-class specialty insurance partners.</p></div>
        <button className="primary-button"><Plus size={17} /> Add target MGA</button>
      </section>
      <section className="pipeline-banner">
        <div><span>Active pipeline</span><strong>{formatMoney(prospects.reduce((sum, mga) => sum + latestEbitda(mga), 0))}</strong><small>Combined target EBITDA</small></div>
        <div><span>Weighted pipeline</span><strong>$14.7M</strong><small>Risk-adjusted value</small></div>
        <div><span>Average growth</span><strong>{(prospects.reduce((sum, mga) => sum + growth(mga), 0) / prospects.length).toFixed(1)}%</strong><small>Year over year</small></div>
        <div><span>Best-in-class</span><strong>{prospects.filter((mga) => mga.experience >= 20 && growth(mga) > 15).length}</strong><small>Targets meeting criteria</small></div>
      </section>
      <article className="panel">
        <div className="filter-row">
          <div className="filter-title"><Filter size={17} /><strong>Filter targets</strong></div>
          <label className="filter-control">Region
            <select value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Filter by region">
              <option>All regions</option>{regions.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label className="checkbox-control">
            <input type="checkbox" checked={onlyExperienced} onChange={(e) => setOnlyExperienced(e.target.checked)} />
            <span><Check size={13} /></span>20+ years experience
          </label>
          <label className="filter-control sort-control">Sort by
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort targets">
              <option value="growth">Highest growth</option>
              <option value="ebitda">Highest EBITDA</option>
              <option value="experience">Most experience</option>
            </select>
          </label>
        </div>
        <div className="results-meta"><strong>{filtered.length} targets</strong><span>Updated today at 4:30 PM</span></div>
        {filtered.length ? <MfaTable items={filtered} /> : <div className="empty-state"><Search size={24} /><strong>No matching MGAs</strong><p>Try broadening the selected region or experience criteria.</p></div>}
      </article>
    </>
  )
}

const synergies = [
  { name: 'Commercial Property', type: 'Line of business', partners: ['SR', 'CS'], reach: 'Mountain West + Southeast', score: 92 },
  { name: 'E&O', type: 'Coverage', partners: ['HU', 'PC'], reach: 'Northeast + Midwest', score: 81 },
  { name: 'CAT Property', type: 'Coverage', partners: ['CS', 'SR'], reach: 'Gulf Coast + Southwest', score: 76 },
]

function Portfolio() {
  return (
    <>
      <section className="hero-heading page-heading">
        <div><p className="eyebrow">Aggregated portfolio</p><h2>One Platform</h2><p>See shared capabilities, regional reach, and cross-sell potential.</p></div>
        <button className="secondary-button"><ArrowDown size={17} /> Export board view</button>
      </section>
      <section className="platform-grid">
        {portfolio.map((mga) => (
          <article className="mga-card" key={mga.id}>
            <div className="mga-card-top"><span style={{ background: mga.accent }}>{mga.initials}</span><StatusBadge stage={mga.stage} /></div>
            <h3>{mga.name}</h3><p><MapPin size={14} />{mga.headquarters}</p>
            <div className="mga-metrics"><div><small>EBITDA</small><strong>{formatMoney(latestEbitda(mga))}</strong></div><div><small>YoY growth</small><strong className="positive">+{growth(mga).toFixed(1)}%</strong></div></div>
            <div className="tag-list">{mga.lines.map((line) => <span key={line}>{line}</span>)}</div>
          </article>
        ))}
      </section>
      <article className="panel synergy-panel">
        <SectionHeader eyebrow="Cross-platform intelligence" title="Highest-value synergies" action={<span className="ai-pill"><Sparkles size={14} /> Intelligence score</span>} />
        <div className="synergy-list">
          {synergies.map((item) => (
            <div className="synergy-row" key={item.name}>
              <div className="score-ring" style={{ '--score': `${item.score * 3.6}deg` } as CSSProperties}><span>{item.score}</span></div>
              <div className="synergy-name"><strong>{item.name}</strong><small>{item.type}</small></div>
              <div className="partner-pair"><span>{item.partners[0]}</span><i /><span>{item.partners[1]}</span></div>
              <div className="synergy-reach"><MapPin size={14} /><span>{item.reach}</span></div>
              <button className="row-action" aria-label={`View ${item.name} synergy`}><ArrowUpRight size={17} /></button>
            </div>
          ))}
        </div>
      </article>
    </>
  )
}

function Directory({ agencies = false }: { agencies?: boolean }) {
  if (agencies) {
    return (
      <>
        <section className="hero-heading page-heading"><div><p className="eyebrow">Distribution network</p><h2>Retail Network</h2><p>The independent agencies managed across every MGA relationship.</p></div></section>
        <section className="stats-grid three">
          <StatCard label="Retail agencies" value="290" note="23 added this quarter" icon={Users} tone="blue" />
          <StatCard label="States represented" value="38" note="76% national coverage" icon={MapPin} tone="green" />
          <StatCard label="Average per MGA" value="41" note="Healthy distribution mix" icon={Network} tone="gold" />
        </section>
        <article className="panel agency-placeholder">
          <Network size={32} /><h3>Agency relationship map</h3>
          <p>Each of the 290 retail agencies rolls up to its associated MGA, preserving clear ownership and distribution visibility.</p>
          <div className="network-demo"><span>Newport platform</span><i /><span>7 MGAs</span><i /><span>290 agencies</span></div>
        </article>
      </>
    )
  }
  return (
    <>
      <section className="hero-heading page-heading"><div><p className="eyebrow">Master records</p><h2>All MGAs</h2><p>A single source of truth for pipeline and portfolio companies.</p></div><button className="primary-button"><Plus size={17} /> Add MGA</button></section>
      <article className="panel"><MfaTable items={mgas} /></article>
    </>
  )
}

export default function App() {
  const [view, setView] = useState<View>('overview')
  const [navOpen, setNavOpen] = useState(false)
  const titles: Record<View, string> = {
    overview: 'Portfolio Intelligence',
    pipeline: 'M&A Pipeline',
    portfolio: 'One Platform',
    mgas: 'All MGAs',
    agencies: 'Retail Network',
  }
  return (
    <div className="app-shell">
      <Sidebar active={view} onNavigate={setView} open={navOpen} close={() => setNavOpen(false)} />
      <div className="main-shell">
        <Header title={titles[view]} openNav={() => setNavOpen(true)} />
        <main>
          {view === 'overview' && <Overview navigate={setView} />}
          {view === 'pipeline' && <Pipeline />}
          {view === 'portfolio' && <Portfolio />}
          {view === 'mgas' && <Directory />}
          {view === 'agencies' && <Directory agencies />}
        </main>
        <footer>Newport Specialty Partners · Confidential portfolio intelligence</footer>
      </div>
    </div>
  )
}
