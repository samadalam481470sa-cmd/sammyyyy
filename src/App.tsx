import { useMemo, useState } from 'react'
import {
  Bell, Building2, ChevronRight, CircleHelp, FileText, Home, Import, LayoutDashboard,
  Menu, MoreHorizontal, Plus, Search, Settings, Sparkles, TrendingUp, Upload, Users,
  X, ClipboardList, BarChart3, ArrowUpRight, Clock3, CheckCircle2, AlertTriangle,
} from 'lucide-react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ACQUISITION_STAGES, formatMoney, opportunities, STATUSES, type Opportunity, type Status, type Stage } from './data'

type NavItem = { label: string; icon: typeof Home }
const nav: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard }, { label: 'Opportunities', icon: Building2 },
  { label: 'Relationships', icon: Users }, { label: 'Tasks & Follow-Ups', icon: ClipboardList },
  { label: 'Sources / Bankers', icon: TrendingUp }, { label: 'Carriers / Reinsurers', icon: CircleHelp },
  { label: 'Portfolio Companies', icon: Building2 }, { label: 'Documents', icon: FileText }, { label: 'Reports', icon: BarChart3 },
]

const initials = (name: string) => name.split(' ').map((word) => word[0]).join('')

function App() {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('All Deals')
  const [stage, setStage] = useState<Stage | null>(null)
  const [search, setSearch] = useState('')
  const [attentionOnly, setAttentionOnly] = useState(false)
  const [selected, setSelected] = useState<Opportunity | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const filtered = useMemo(() => opportunities.filter((item) => {
    const statusMatch = status === 'All Deals' || item.status === status
    const stageMatch = !stage || item.stage === stage
    const text = `${item.projectName} ${item.entityName}`.toLowerCase()
    return statusMatch && stageMatch && (!attentionOnly || item.needsAttention) && text.includes(search.toLowerCase())
  }), [status, stage, attentionOnly, search])

  const active = opportunities.filter((item) => item.status === 'Active')
  const activeNwp = active.reduce((total, item) => total + item.nwp, 0)
  const activeEbitda = active.reduce((total, item) => total + item.pfEbitda, 0)
  const clearFilters = () => { setStatus('All Deals'); setStage(null); setSearch(''); setAttentionOnly(false) }
  const chooseStage = (value: Stage) => { setStage(stage === value ? null : value); setAttentionOnly(false) }

  const statusData = ['Active', 'Pending', 'Inactive', 'Declined', 'Closed', 'Completed'].map((label) => ({
    name: label, deals: filtered.filter((item) => item.status === label).length,
  }))
  const stageData = ACQUISITION_STAGES.filter((s) => filtered.some((item) => item.status === 'Active' && item.stage === s)).map((s) => ({
    name: s, deals: filtered.filter((item) => item.status === 'Active' && item.stage === s).length,
  }))

  return <div className="app-shell">
    <Sidebar open={sidebarOpen} close={() => setSidebarOpen(false)} />
    <main className="main">
      <TopHeader search={search} setSearch={setSearch} toggleMenu={() => setSidebarOpen(true)} />
      <div className="dashboard">
        <section className="intro">
          <p className="eyebrow">ACQUISITION &amp; STRATEGIC GROWTH CRM</p>
          <h1>Good afternoon, Mary</h1>
          <p>Here’s what’s happening across Newport’s acquisition pipeline.</p>
        </section>
        <section className="filter-row">
          <div className="status-filter" aria-label="Deal status filter">
            {STATUSES.map((option) => <button key={option} className={status === option ? 'selected' : ''} onClick={() => { setStatus(option); setAttentionOnly(false) }}>{option}</button>)}
          </div>
          {(status !== 'All Deals' || stage || attentionOnly || search) && <button className="clear" onClick={clearFilters}>Clear filters <X size={14} /></button>}
        </section>
        <section className="kpis">
          <Kpi label="Active Deals" value={active.length.toString()} detail="Across the acquisition pipeline" icon={<TrendingUp />} />
          <Kpi label="Pending Deals" value={opportunities.filter((item) => item.status === 'Pending').length.toString()} detail="Awaiting next movement" icon={<Clock3 />} />
          <Kpi label="Active NWP" value={formatMoney(activeNwp)} detail="Net Written Premium" icon={<ArrowUpRight />} />
          <Kpi label="Active PF EBITDA" value={formatMoney(activeEbitda)} detail="Pro Forma EBITDA" icon={<BarChart3 />} />
          <Kpi label="Needs Attention" value={opportunities.filter((item) => item.needsAttention).length.toString()} detail="Deals requiring follow-up" icon={<AlertTriangle />} attention onClick={() => { setAttentionOnly(!attentionOnly); setStage(null) }} />
        </section>
        <section className="panel pipeline-panel">
          <div className="panel-heading"><div><p className="eyebrow">ACTIVE OPPORTUNITIES</p><h2>Acquisition Pipeline</h2></div><span className="muted">{active.length} active deals</span></div>
          <div className="pipeline">
            {ACQUISITION_STAGES.map((item, index) => {
              const deals = active.filter((opportunity) => opportunity.stage === item)
              return <button key={item} onClick={() => chooseStage(item)} className={`pipeline-stage ${stage === item ? 'stage-selected' : ''}`}>
                <span className="stage-index">{String(index + 1).padStart(2, '0')}</span><strong>{item}</strong><span>{deals.length} {deals.length === 1 ? 'deal' : 'deals'} · {formatMoney(deals.reduce((total, opportunity) => total + opportunity.nwp, 0))}</span>
              </button>
            })}
          </div>
        </section>
        <section className="panel deals-panel">
          <div className="panel-heading"><div><p className="eyebrow">WORK QUEUE</p><h2>Priority Deals</h2></div><span className="muted">{filtered.length} opportunities</span></div>
          <DealsTable data={filtered} select={setSelected} />
        </section>
        <section className="two-column">
          <PriorityTasks select={setSelected} />
          <Attention data={opportunities.filter((item) => item.needsAttention)} select={setSelected} />
        </section>
        <section className="analytics">
          <ChartCard title="Deals by Status" subtitle="Current view" data={statusData} />
          <ChartCard title="Active Deals by Stage" subtitle="Current view" data={stageData} />
        </section>
        <section className="lower-grid">
          <RecentActivity />
          <div className="side-stack"><QuickActions /><NewportAI /></div>
        </section>
      </div>
    </main>
    {selected && <OpportunityDrawer opportunity={selected} close={() => setSelected(null)} />}
  </div>
}

function Sidebar({ open, close }: { open: boolean; close: () => void }) {
  return <aside className={`sidebar ${open ? 'open' : ''}`}>
    <div className="brand"><div className="brand-mark">N</div><div><strong>NEWPORT</strong><span>SPECIALTY PARTNERS</span></div><button className="sidebar-close" onClick={close}><X /></button></div>
    <nav>{nav.map(({ label, icon: Icon }) => <button key={label} className={label === 'Dashboard' ? 'active' : ''} onClick={close}><Icon size={18} /><span>{label}</span>{label === 'Dashboard' && <ChevronRight size={16} />}</button>)}</nav>
    <button className="settings"><Settings size={18} />Settings</button>
  </aside>
}

function TopHeader({ search, setSearch, toggleMenu }: { search: string; setSearch: (value: string) => void; toggleMenu: () => void }) {
  return <header className="top-header"><button className="menu-button" onClick={toggleMenu}><Menu /></button><div className="search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects, companies, contacts..." /></div><div className="header-actions"><button className="icon-button"><Bell size={19} /><i /></button><button className="avatar">MS</button><button className="new-opportunity"><Plus size={17} />New Opportunity</button></div></header>
}

function Kpi({ label, value, detail, icon, attention, onClick }: { label: string; value: string; detail: string; icon: React.ReactNode; attention?: boolean; onClick?: () => void }) {
  return <button className={`kpi ${attention ? 'attention-kpi' : ''}`} onClick={onClick}><span className="kpi-icon">{icon}</span><div><span className="kpi-label">{label}</span><strong>{value}</strong><small>{detail}</small></div></button>
}

function DealsTable({ data, select }: { data: Opportunity[]; select: (opportunity: Opportunity) => void }) {
  return <div className="table-wrap"><table><thead><tr><th>Project</th><th>Status</th><th>Stage</th><th>Deal Lead</th><th>NWP</th><th>Net Revenue</th><th>PF EBITDA</th><th>Next Action</th><th>Next Action Date</th></tr></thead><tbody>
    {data.length ? data.map((item) => <tr key={item.id} onClick={() => select(item)}><td><strong className="project">{item.projectName}</strong><span className="entity">{item.entityName}</span></td><td><StatusPill status={item.status} /></td><td><span className="stage-pill">{item.stage}</span></td><td><span className="lead"><i>{initials(item.dealLead)}</i>{item.dealLead}</span></td><td>{formatMoney(item.nwp)}</td><td>{formatMoney(item.netRevenue)}</td><td>{formatMoney(item.pfEbitda)}</td><td>{item.nextAction ?? <span className="missing">Unassigned</span>}</td><td className={item.needsAttention ? 'date-alert' : ''}>{item.nextActionDate ?? '—'}</td></tr>) : <tr><td colSpan={9} className="empty">No opportunities match these filters.</td></tr>}
  </tbody></table></div>
}

function StatusPill({ status }: { status: Status }) { return <span className={`status status-${status.toLowerCase()}`}>{status}</span> }

function PriorityTasks({ select }: { select: (opportunity: Opportunity) => void }) {
  const tasks = opportunities.filter((item) => item.priority !== 'C').slice(0, 5)
  return <section className="panel tasks"><div className="panel-heading"><div><p className="eyebrow">ACTION LIST</p><h2>This Week’s Priorities</h2></div><button className="text-button">View all</button></div><div className="task-list">{tasks.map((task) => <button className="task" key={task.id} onClick={() => select(task)}><span className={`priority priority-${task.priority}`}>{task.priority}</span><div><strong>{task.nextAction ?? 'Assign next action'}</strong><span>{task.projectName} · {task.dealLead}</span></div><time>{task.nextActionDate ?? 'No date'}</time></button>)}</div></section>
}

function Attention({ data, select }: { data: Opportunity[]; select: (opportunity: Opportunity) => void }) {
  return <section className="panel attention"><div className="panel-heading"><div><p className="eyebrow">EXCEPTIONS</p><h2>Needs Attention</h2></div><AlertTriangle className="warning" size={20} /></div><div className="attention-list">{data.map((item) => <button key={item.id} onClick={() => select(item)}><span className="warning-dot" /><div><strong>{item.attentionReason}</strong><span>{item.projectName} · {item.entityName}</span></div><ChevronRight size={17} /></button>)}</div></section>
}

function ChartCard({ title, subtitle, data }: { title: string; subtitle: string; data: { name: string; deals: number }[] }) {
  return <section className="panel chart"><div className="panel-heading"><div><p className="eyebrow">{subtitle}</p><h2>{title}</h2></div><MoreHorizontal size={20} /></div><div className="chart-area"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 4, right: 4, left: -26, bottom: 0 }}><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#687587', fontSize: 10 }} interval={0} angle={data.length > 5 ? -22 : 0} textAnchor={data.length > 5 ? 'end' : 'middle'} height={data.length > 5 ? 55 : 30} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#8c96a5', fontSize: 11 }} /><Tooltip cursor={{ fill: '#f5f8fc' }} contentStyle={{ borderRadius: 10, border: '1px solid #dce4ef', boxShadow: '0 6px 18px rgba(12, 30, 52, .08)' }} /><Bar dataKey="deals" fill="#1573a8" radius={[4, 4, 0, 0]} maxBarSize={38} /></BarChart></ResponsiveContainer></div></section>
}

function RecentActivity() { const activities = [
  ['Dennis DiCapua', 'moved', 'Project Guardian', 'to NDA', '2 hours ago', CheckCircle2],
  ['Mary Sbaschnig', 'added a note to', 'Project Beacon', '', '5 hours ago', FileText],
  ['System', 'uploaded initial materials for', 'Project Jugular', '', 'Yesterday', Upload],
  ['Mary Sbaschnig', 'moved', 'Project Summit', 'from Pending to Active', 'Yesterday', TrendingUp],
  ['Dennis DiCapua', 'updated LOI for', 'Project Atlas', '', '2 days ago', FileText],
]; return <section className="panel activity"><div className="panel-heading"><div><p className="eyebrow">TEAM FEED</p><h2>Recent Activity</h2></div><button className="text-button">View activity</button></div><div className="activity-list">{activities.map(([person, verb, project, tail, time, Icon], index) => <div className="activity-row" key={index}><span className="activity-icon">{typeof Icon === 'function' && <Icon size={16} />}</span><p><strong>{person as string}</strong> {verb as string} <b>{project as string}</b> {tail as string}<time>{time as string}</time></p></div>)}</div></section> }

function QuickActions() { return <section className="panel quick-actions"><p className="eyebrow">SHORTCUTS</p><h2>Quick Actions</h2><div><button><Plus />New Opportunity</button><button><ClipboardList />Add Task</button><button><FileText />Log Activity</button><button><Import />Import Excel</button></div></section> }

function NewportAI() { return <section className="panel ai"><div className="ai-title"><span><Sparkles size={16} /></span><div><p className="eyebrow">PRIVATE BETA</p><h2>Newport AI</h2></div></div><div className="ai-input"><Sparkles size={16} /><input placeholder="Ask about your acquisition pipeline..." /><button>Ask</button></div><div className="chips"><button>Which deals need attention?</button><button>What changed this week?</button><button>Show active deals with no next action</button></div></section> }

function OpportunityDrawer({ opportunity, close }: { opportunity: Opportunity; close: () => void }) {
  return <div className="drawer-overlay" onClick={close}><aside className="drawer" onClick={(event) => event.stopPropagation()}><button className="drawer-close" onClick={close}><X /></button><p className="eyebrow">OPPORTUNITY SNAPSHOT</p><h2>{opportunity.projectName}</h2><p className="drawer-entity">{opportunity.entityName}</p><div className="drawer-pills"><StatusPill status={opportunity.status} /><span className="stage-pill">{opportunity.stage}</span></div><div className="details"><Detail label="Deal Lead" value={opportunity.dealLead} /><Detail label="NWP" value={formatMoney(opportunity.nwp)} /><Detail label="Net Revenue" value={formatMoney(opportunity.netRevenue)} /><Detail label="PF EBITDA" value={formatMoney(opportunity.pfEbitda)} /><Detail label="Next Action" value={opportunity.nextAction ?? 'No next action assigned'} /><Detail label="Next Action Date" value={opportunity.nextActionDate ?? '—'} /></div><div className="coming-soon"><Building2 size={18} /><div><strong>Full Opportunity Profile</strong><span>Coming in next sprint</span></div></div></aside></div>
}
function Detail({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div> }
export default App
