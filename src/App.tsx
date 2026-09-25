import { useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowRight, Bell, Bot, BriefcaseBusiness, Building2, CalendarClock,
  ChartNoAxesCombined, CheckSquare, ChevronLeft, ChevronRight, CircleDollarSign, Clock3,
  Database, FileText, FolderLock, Handshake, LayoutDashboard, Menu, MessageSquareText, Plus,
  Search, Settings, ShieldCheck, Sparkles, Upload, Users, X,
} from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  DEAL_STAGES, DEAL_STATUSES, opportunities, recentActivity, weeklyPriorities,
  type DealStage, type DealStatus, type Opportunity,
} from './data'

type StatusFilter = 'All Deals' | DealStatus

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Opportunities', icon: BriefcaseBusiness },
  { label: 'Relationships', icon: Users },
  { label: 'Tasks & Follow-Ups', icon: CheckSquare },
  { label: 'Sources / Bankers', icon: Handshake },
  { label: 'Carriers / Reinsurers', icon: ShieldCheck },
  { label: 'Portfolio Companies', icon: Building2 },
  { label: 'Documents', icon: FolderLock },
  { label: 'Reports', icon: ChartNoAxesCombined },
]

const money = (value: number, digits = 0) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: digits,
  }).format(value)

const dateLabel = (value: string | null) =>
  value ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${value}T12:00:00`)) : 'Not set'

function BrandMark() {
  return <div className="brand-mark" aria-hidden="true"><span>N</span></div>
}

function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: {
  collapsed: boolean; onToggle: () => void; mobileOpen: boolean; onMobileClose: () => void
}) {
  return (
    <>
      {mobileOpen && <button className="sidebar-backdrop" onClick={onMobileClose} aria-label="Close navigation" />}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <BrandMark />
          {!collapsed && <div><strong>NEWPORT</strong><span>SPECIALTY PARTNERS</span></div>}
          <button className="mobile-close" onClick={onMobileClose} aria-label="Close navigation"><X size={19} /></button>
        </div>
        <div className="brand-rule" />
        {!collapsed && <p className="sidebar-eyebrow">ACQUISITION CRM</p>}
        <nav aria-label="Primary navigation">
          {navItems.map(({ label, icon: Icon }, index) => (
            <button
              key={label}
              className={`nav-item ${index === 0 ? 'active' : ''}`}
              aria-current={index === 0 ? 'page' : undefined}
              title={collapsed ? label : undefined}
              onClick={index === 0 ? onMobileClose : undefined}
            >
              <Icon size={19} strokeWidth={1.8} />
              {!collapsed && <span>{label}</span>}
              {index !== 0 && !collapsed && <span className="soon-dot" title="Coming soon" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item" title={collapsed ? 'Settings' : undefined}>
            <Settings size={19} />{!collapsed && <span>Settings</span>}
          </button>
          {!collapsed && <div className="secure-note"><ShieldCheck size={15} /><span>Confidential workspace</span></div>}
          <button className="collapse-button" onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <ChevronRight size={17} /> : <><ChevronLeft size={17} /><span>Collapse</span></>}
          </button>
        </div>
      </aside>
    </>
  )
}

function TopHeader({ onMenu, onNew }: { onMenu: () => void; onNew: () => void }) {
  return (
    <header className="top-header">
      <button className="mobile-menu" onClick={onMenu} aria-label="Open navigation"><Menu size={22} /></button>
      <div className="header-spacer" />
      <div className="header-actions">
        <button className="icon-button notification-button" aria-label="Notifications"><Bell size={19} /><i /></button>
        <div className="profile">
          <div className="avatar">MS</div>
          <div><strong>Mary Sbaschnig</strong><span>Managing Partner</span></div>
        </div>
        <button className="primary-button" onClick={onNew}><Plus size={18} /> New Opportunity</button>
      </div>
    </header>
  )
}

function StatusFilterBar({ value, onChange, hasFilters, onClear }: {
  value: StatusFilter; onChange: (value: StatusFilter) => void; hasFilters: boolean; onClear: () => void
}) {
  const options: StatusFilter[] = ['All Deals', ...DEAL_STATUSES]
  return (
    <div className="status-row">
      <div className="status-tabs" role="group" aria-label="Filter by deal status">
        {options.map(option => (
          <button key={option} className={value === option ? 'selected' : ''} onClick={() => onChange(option)}>
            {option}
          </button>
        ))}
      </div>
      {hasFilters && <button className="clear-button" onClick={onClear}><X size={14} /> Clear filters</button>}
    </div>
  )
}

function KPICard({ label, value, meta, icon: Icon, tone, active, onClick }: {
  label: string; value: string; meta: string; icon: typeof Activity; tone?: 'attention'; active?: boolean; onClick?: () => void
}) {
  return (
    <button className={`kpi-card ${tone ?? ''} ${active ? 'kpi-active' : ''}`} onClick={onClick} aria-label={label}>
      <div className="kpi-top"><span>{label}</span><span className="kpi-icon"><Icon size={18} /></span></div>
      <strong>{value}</strong>
      <small>{meta}</small>
    </button>
  )
}

function PipelineOverview({ deals, selected, onSelect }: {
  deals: Opportunity[]; selected: DealStage | null; onSelect: (stage: DealStage) => void
}) {
  const activeDeals = deals.filter(deal => deal.status === 'Active')
  const maxNwp = Math.max(...DEAL_STAGES.map(stage =>
    activeDeals.filter(deal => deal.stage === stage).reduce((sum, deal) => sum + deal.nwp, 0)
  ), 1)

  return (
    <section className="panel pipeline-panel">
      <div className="section-heading">
        <div><p className="eyebrow">PORTFOLIO VIEW</p><h2>Acquisition Pipeline</h2><span>Active opportunities by current acquisition stage</span></div>
        <div className="live-key"><i /> Active pipeline</div>
      </div>
      <div className="pipeline-scroll">
        <div className="pipeline-track">
          {DEAL_STAGES.map((stage, index) => {
            const stageDeals = activeDeals.filter(deal => deal.stage === stage)
            const total = stageDeals.reduce((sum, deal) => sum + deal.nwp, 0)
            const width = total ? Math.max(28, (total / maxNwp) * 100) : 5
            return (
              <button
                key={stage}
                className={`pipeline-stage ${selected === stage ? 'selected' : ''}`}
                onClick={() => onSelect(stage)}
                aria-pressed={selected === stage}
                aria-label={stage}
              >
                <div className="stage-index">{String(index + 1).padStart(2, '0')}</div>
                <div className="stage-content">
                  <div className="stage-label"><span>{stage}</span><strong>{stageDeals.length}</strong></div>
                  <div className="stage-bar"><i style={{ width: `${width}%` }} /></div>
                  <small>{total ? `${money(total)} NWP` : 'No active deals'}</small>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function StatusBadge({ status }: { status: DealStatus }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}><i />{status}</span>
}

function DealsTable({ deals, onOpen }: { deals: Opportunity[]; onOpen: (deal: Opportunity) => void }) {
  return (
    <section className="panel deals-panel">
      <div className="section-heading compact-heading">
        <div><p className="eyebrow">ACTIVE WORKSTREAM</p><h2>Priority Deals</h2><span>{deals.length} opportunities in this view</span></div>
        <button className="text-button">View all opportunities <ArrowRight size={15} /></button>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr>
            <th>Project / Entity</th><th>Status</th><th>Stage</th><th>Deal Lead</th>
            <th>NWP</th><th>Net Revenue</th><th>PF EBITDA</th><th>Next Action</th><th>Date</th>
          </tr></thead>
          <tbody>
            {deals.slice(0, 7).map(deal => (
              <tr key={deal.id} onClick={() => onOpen(deal)}>
                <td><strong className="project-name">{deal.projectName}</strong><span className="entity-name">{deal.entityName}</span></td>
                <td><StatusBadge status={deal.status} /></td>
                <td><span className="stage-text">{deal.stage}</span></td>
                <td><span className="lead-cell"><i>{deal.dealLead.split(' ').map(n => n[0]).join('')}</i>{deal.dealLead}</span></td>
                <td className="number-cell">{money(deal.nwp)}</td>
                <td className="number-cell">{money(deal.netRevenue, 1)}</td>
                <td className="number-cell">{money(deal.pfEbitda, 1)}</td>
                <td className={deal.nextAction ? 'action-cell' : 'action-cell missing'}>{deal.nextAction ?? 'Action needed'}</td>
                <td className={deal.attentionReason === 'Next action overdue' ? 'date-cell overdue' : 'date-cell'}>{dateLabel(deal.nextActionDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!deals.length && (
          <div className="empty-state"><Search size={24} /><strong>No matching opportunities</strong><span>Try adjusting your status, stage, or search filters.</span></div>
        )}
      </div>
      <div className="demo-disclaimer"><Database size={14} />Illustrative demo data — not actual Newport financial information.</div>
    </section>
  )
}

function Priorities() {
  return (
    <section className="panel side-card">
      <div className="section-heading compact-heading"><div><p className="eyebrow">EXECUTION</p><h2>This Week’s Priorities</h2></div><button className="icon-button small"><Plus size={17} /></button></div>
      <div className="priority-list">
        {weeklyPriorities.map((item, index) => (
          <div className="priority-item" key={`${item.project}-${index}`}>
            <span className={`priority-rank rank-${item.priority}`}>{item.priority}</span>
            <div><strong>{item.action}</strong><span>{item.project} · {item.owner}</span></div>
            <time className={item.due === 'Overdue' ? 'overdue' : ''}>{item.due}</time>
          </div>
        ))}
      </div>
    </section>
  )
}

function Attention({ deals, onOpen }: { deals: Opportunity[]; onOpen: (deal: Opportunity) => void }) {
  const alerts = deals.filter(deal => deal.needsAttention)
  return (
    <section className="panel side-card attention-card">
      <div className="section-heading compact-heading"><div><p className="eyebrow">EXCEPTIONS</p><h2>Needs Attention</h2></div><span className="alert-count">{alerts.length}</span></div>
      <div className="alert-list">
        {alerts.map(deal => (
          <button key={deal.id} className="alert-item" onClick={() => onOpen(deal)}>
            <span className="alert-icon"><AlertTriangle size={16} /></span>
            <div><strong>{deal.attentionReason}</strong><span>{deal.projectName}</span></div>
            <ChevronRight size={16} />
          </button>
        ))}
      </div>
    </section>
  )
}

const tooltipStyle = {
  border: '1px solid #dfe6ec', borderRadius: '10px', boxShadow: '0 8px 24px rgba(8,29,51,.1)',
  fontSize: '12px', color: '#172b3e',
}

function DashboardCharts({ deals }: { deals: Opportunity[] }) {
  const statusData = DEAL_STATUSES.filter(status => status !== 'Withdrew').map(status => ({
    name: status, value: deals.filter(deal => deal.status === status).length,
  }))
  const stageData = DEAL_STAGES.map(stage => ({
    name: stage.replace('Preliminary Discussion', 'Prelim. Discussion').replace('Target Identified', 'Target ID'),
    value: deals.filter(deal => deal.status === 'Active' && deal.stage === stage).length,
  })).filter(point => point.value)
  const colors = ['#1c6b91', '#7faac0', '#9aa8b3', '#b58b62', '#53697b', '#42a18b']

  return (
    <div className="charts-grid">
      <section className="panel chart-panel">
        <div className="section-heading compact-heading"><div><p className="eyebrow">COMPOSITION</p><h2>Deals by Status</h2></div></div>
        <div className="status-chart-wrap">
          <div className="chart-area">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={88} paddingAngle={3} stroke="none">
                {statusData.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]} />)}
              </Pie><Tooltip contentStyle={tooltipStyle} /></PieChart>
            </ResponsiveContainer>
            <div className="donut-label"><strong>{deals.length}</strong><span>Total deals</span></div>
          </div>
          <div className="chart-legend">{statusData.map((item, index) => (
            <div key={item.name}><i style={{ background: colors[index % colors.length] }} /><span>{item.name}</span><strong>{item.value}</strong></div>
          ))}</div>
        </div>
      </section>
      <section className="panel chart-panel">
        <div className="section-heading compact-heading"><div><p className="eyebrow">PROGRESSION</p><h2>Active Deals by Stage</h2></div></div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={stageData} margin={{ top: 12, right: 5, left: -28, bottom: 15 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf1f4" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#687987' }} interval={0} angle={-22} textAnchor="end" height={62} />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#84919c' }} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f4f7f9' }} />
            <Bar dataKey="value" name="Deals" fill="#1d6f94" radius={[5, 5, 0, 0]} maxBarSize={42} />
          </BarChart>
        </ResponsiveContainer>
      </section>
    </div>
  )
}

const activityIcons = { stage: Activity, note: MessageSquareText, file: FileText, status: CheckSquare }

function RecentActivity() {
  return (
    <section className="panel side-card activity-card">
      <div className="section-heading compact-heading"><div><p className="eyebrow">TEAM UPDATE</p><h2>Recent Activity</h2></div><button className="text-button">View all</button></div>
      <div className="activity-list">
        {recentActivity.map((item, index) => {
          const Icon = activityIcons[item.type as keyof typeof activityIcons]
          return <div className="activity-item" key={index}><span><Icon size={15} /></span><div><strong>{item.text}</strong><time>{item.time}</time></div></div>
        })}
      </div>
    </section>
  )
}

function QuickActions({ onNew }: { onNew: () => void }) {
  const actions = [
    { label: 'New Opportunity', icon: Plus, onClick: onNew },
    { label: 'Add Task', icon: CheckSquare },
    { label: 'Log Activity', icon: MessageSquareText },
    { label: 'Import Excel', icon: Upload },
  ]
  return (
    <section className="panel quick-actions">
      <div><p className="eyebrow">SHORTCUTS</p><h2>Quick Actions</h2></div>
      <div>{actions.map(({ label, icon: Icon, onClick }) => <button key={label} onClick={onClick}><Icon size={17} /><span>{label}</span></button>)}</div>
    </section>
  )
}

function NewportAI() {
  const prompts = ['Which deals need attention?', 'What changed this week?', 'Show active deals with no next action', 'Summarize Project Guardian']
  const [query, setQuery] = useState('')
  const [response, setResponse] = useState('')
  const ask = (text = query) => {
    if (!text.trim()) return
    setQuery(text)
    setResponse('Newport AI is ready for secure pipeline insights. Data-connected responses will be enabled in a future sprint.')
  }
  return (
    <section className="ai-panel">
      <div className="ai-header"><span><Bot size={20} /></span><div><strong>Newport AI</strong><small>Pipeline intelligence assistant</small></div><i><Sparkles size={13} /> Prototype</i></div>
      <div className="ai-body">
        <div className="ai-input"><input value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => event.key === 'Enter' && ask()} placeholder="Ask about your acquisition pipeline..." /><button onClick={() => ask()} aria-label="Ask Newport AI"><ArrowRight size={18} /></button></div>
        <div className="prompt-chips">{prompts.map(prompt => <button key={prompt} onClick={() => ask(prompt)}>{prompt}</button>)}</div>
        {response && <p className="ai-response"><Sparkles size={14} />{response}</p>}
      </div>
    </section>
  )
}

function OpportunityDrawer({ deal, onClose }: { deal: Opportunity | null; onClose: () => void }) {
  if (!deal) return null
  const details = [
    ['Status', deal.status], ['Stage', deal.stage], ['Deal lead', deal.dealLead], ['NWP', money(deal.nwp)],
    ['Net Revenue', money(deal.netRevenue, 1)], ['PF EBITDA', money(deal.pfEbitda, 1)],
  ]
  return (
    <>
      <button className="drawer-backdrop" onClick={onClose} aria-label="Close opportunity details" />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <div className="drawer-header"><div><p className="eyebrow">OPPORTUNITY OVERVIEW</p><h2 id="drawer-title">{deal.projectName}</h2><span>{deal.entityName}</span></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
        <div className="confidential-banner"><FolderLock size={15} /> Confidential acquisition opportunity</div>
        <div className="drawer-details">
          {details.map(([label, value]) => <div key={label}><span>{label}</span>{label === 'Status' ? <StatusBadge status={deal.status} /> : <strong>{value}</strong>}</div>)}
        </div>
        <div className="next-action-block"><span>NEXT ACTION</span><strong>{deal.nextAction ?? 'No next action assigned'}</strong><small><CalendarClock size={14} />{dateLabel(deal.nextActionDate)}</small></div>
        {deal.needsAttention && <div className="drawer-alert"><AlertTriangle size={17} /><div><strong>Needs attention</strong><span>{deal.attentionReason}</span></div></div>}
        <div className="drawer-footer"><BriefcaseBusiness size={18} /><div><strong>Full Opportunity Profile</strong><span>Coming in next sprint</span></div><ArrowRight size={17} /></div>
      </aside>
    </>
  )
}

function PrototypeNotice({ text, onClose }: { text: string; onClose: () => void }) {
  return <div className="prototype-notice"><CheckSquare size={17} /><span><strong>{text}</strong> workflow will be enabled in a future sprint.</span><button onClick={onClose}><X size={15} /></button></div>
}

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [status, setStatus] = useState<StatusFilter>('All Deals')
  const [stage, setStage] = useState<DealStage | null>(null)
  const [attentionOnly, setAttentionOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedDeal, setSelectedDeal] = useState<Opportunity | null>(null)
  const [notice, setNotice] = useState('')

  const filteredDeals = useMemo(() => opportunities.filter(deal => {
    const matchesStatus = status === 'All Deals' || deal.status === status
    const matchesStage = !stage || deal.stage === stage
    const matchesAttention = !attentionOnly || deal.needsAttention
    const term = search.trim().toLowerCase()
    const matchesSearch = !term || `${deal.projectName} ${deal.entityName}`.toLowerCase().includes(term)
    return matchesStatus && matchesStage && matchesAttention && matchesSearch
  }), [status, stage, attentionOnly, search])

  const activeDeals = opportunities.filter(deal => deal.status === 'Active')
  const pendingDeals = opportunities.filter(deal => deal.status === 'Pending')
  const attentionDeals = opportunities.filter(deal => deal.needsAttention)
  const clearFilters = () => { setStatus('All Deals'); setStage(null); setAttentionOnly(false); setSearch('') }
  const hasFilters = status !== 'All Deals' || !!stage || attentionOnly || !!search
  const selectStatus = (next: StatusFilter) => { setStatus(next); setAttentionOnly(false); setStage(null) }
  const selectStage = (next: DealStage) => { setStage(stage === next ? null : next); setStatus('Active'); setAttentionOnly(false) }

  return (
    <div className="app-shell">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(value => !value)} mobileOpen={mobileNav} onMobileClose={() => setMobileNav(false)} />
      <div className={`app-content ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
        <TopHeader onMenu={() => setMobileNav(true)} onNew={() => setNotice('New Opportunity')} />
        <main>
          <section className="welcome-row">
            <div><p className="date-line">FRIDAY, SEPTEMBER 25</p><h1>Good afternoon, Mary</h1><span>Here’s what’s happening across Newport’s acquisition pipeline.</span></div>
            <div className="global-search"><Search size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search projects, companies, contacts..." aria-label="Search opportunities" />{search && <button onClick={() => setSearch('')} aria-label="Clear search"><X size={15} /></button>}</div>
          </section>

          <StatusFilterBar value={status} onChange={selectStatus} hasFilters={hasFilters} onClear={clearFilters} />

          <section className="kpi-grid" aria-label="Executive metrics">
            <KPICard label="Active Deals" value={String(activeDeals.length)} meta="Across 8 acquisition stages" icon={BriefcaseBusiness} active={status === 'Active' && !attentionOnly} onClick={() => selectStatus('Active')} />
            <KPICard label="Pending Deals" value={String(pendingDeals.length)} meta="Awaiting next milestone" icon={Clock3} active={status === 'Pending'} onClick={() => selectStatus('Pending')} />
            <KPICard label="Active NWP" value={money(activeDeals.reduce((sum, deal) => sum + deal.nwp, 0))} meta="Net written premium" icon={CircleDollarSign} />
            <KPICard label="Active PF EBITDA" value={money(activeDeals.reduce((sum, deal) => sum + deal.pfEbitda, 0), 1)} meta="Pro forma EBITDA" icon={ChartNoAxesCombined} />
            <KPICard label="Needs Attention" value={String(attentionDeals.length)} meta="Actions or deadlines at risk" icon={AlertTriangle} tone="attention" active={attentionOnly} onClick={() => { setAttentionOnly(true); setStatus('All Deals'); setStage(null) }} />
          </section>

          <PipelineOverview deals={opportunities} selected={stage} onSelect={selectStage} />

          <div className="workspace-grid">
            <DealsTable deals={filteredDeals} onOpen={setSelectedDeal} />
            <div className="right-rail"><Priorities /><Attention deals={opportunities} onOpen={setSelectedDeal} /></div>
          </div>

          <DashboardCharts deals={filteredDeals} />

          <div className="lower-grid">
            <RecentActivity />
            <div className="lower-side"><QuickActions onNew={() => setNotice('New Opportunity')} /><NewportAI /></div>
          </div>
          <footer><span>Newport Specialty Partners</span><i />Acquisition & Strategic Growth CRM <small>Internal & Confidential</small></footer>
        </main>
      </div>
      <OpportunityDrawer deal={selectedDeal} onClose={() => setSelectedDeal(null)} />
      {notice && <PrototypeNotice text={notice} onClose={() => setNotice('')} />}
    </div>
  )
}
