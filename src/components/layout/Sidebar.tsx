import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Briefcase,
  Users,
  CheckSquare,
  Building2,
  Shield,
  Landmark,
  FileText,
  BarChart3,
  FolderKanban,
  ShieldCheck,
  Ban,
  KeyRound,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  GripVertical,
  Video,
  Settings,
} from 'lucide-react'
import { NAV_ITEMS, type NavItem } from '@/data/constants'
import { useAuth } from '@/auth/AuthContext'
import { fetchNavOrder, getStoredSession, saveNavOrder } from '@/lib/api'
import {
  applyNavOrder,
  loadLocalNavOrder,
  mergeNavOrderWithDefaults,
  moveNavId,
  saveLocalNavOrder,
} from '@/lib/navOrder'
import { sessionOwnerKey } from '@/lib/ownerKey'
import type { LucideIcon } from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  opportunities: Briefcase,
  projects: FolderKanban,
  relationships: Users,
  tasks: CheckSquare,
  sources: Building2,
  carriers: Shield,
  portfolio: Landmark,
  documents: FileText,
  reports: BarChart3,
  meetings: Video,
  security: ShieldCheck,
  'key-control': Ban,
  'key-provision': KeyRound,
}

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

function visibleNavItems(isManager: boolean | undefined): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    if (item.id === 'key-control' || item.id === 'key-provision') {
      return Boolean(isManager)
    }
    return item.enabled
  })
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { signOut, user } = useAuth()
  const navigate = useNavigate()
  const owner = sessionOwnerKey(user)
  const [orderIds, setOrderIds] = useState<string[]>(() =>
    visibleNavItems(user?.isManager).map((item) => item.id),
  )
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const didDragRef = useRef(false)

  const baseItems = useMemo(() => visibleNavItems(user?.isManager), [user?.isManager])

  // Load this user's saved order (local first, then server when available)
  useEffect(() => {
    if (!user?.id) return
    const defaults = visibleNavItems(user.isManager).map((item) => item.id)
    const local = loadLocalNavOrder(owner)
    const initial = mergeNavOrderWithDefaults(defaults, local)
    setOrderIds(initial)
    if (local && initial.join('|') !== local.join('|')) {
      saveLocalNavOrder(owner, initial)
    }

    const localDemo = getStoredSession()?.token === 'local-demo'
    if (localDemo) return

    void fetchNavOrder()
      .then((data) => {
        if (!data.order?.length) return
        const merged = mergeNavOrderWithDefaults(defaults, data.order)
        saveLocalNavOrder(owner, merged)
        setOrderIds(merged)
        // Persist corrected Dashboard-first order when server had a broken layout
        if (merged.join('|') !== data.order.join('|')) {
          void saveNavOrder(merged).catch(() => undefined)
        }
      })
      .catch(() => {
        // offline / unauthorized — keep local order
      })
  }, [user?.id, user?.isManager, owner])

  const items = useMemo(
    () => applyNavOrder(baseItems, orderIds),
    [baseItems, orderIds],
  )

  const persistOrder = (nextIds: string[]) => {
    setOrderIds(nextIds)
    if (!user?.id) return
    saveLocalNavOrder(owner, nextIds)
    if (getStoredSession()?.token === 'local-demo') return
    void saveNavOrder(nextIds).catch(() => {
      // local already saved
    })
  }

  const onDragStart = (index: number) => (e: DragEvent) => {
    didDragRef.current = false
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
    // Improve drag ghost in some browsers
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.55'
    }
  }

  const onDragEnd = (e: DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = ''
    }
    setDragIndex(null)
    setOverIndex(null)
  }

  const onDragOver = (index: number) => (e: DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (overIndex !== index) setOverIndex(index)
  }

  const onDrop = (toIndex: number) => (e: DragEvent) => {
    e.preventDefault()
    const fromRaw = e.dataTransfer.getData('text/plain')
    const fromIndex = Number(fromRaw)
    if (!Number.isInteger(fromIndex) || fromIndex === toIndex) {
      setDragIndex(null)
      setOverIndex(null)
      return
    }
    didDragRef.current = true
    const movableIds = items.filter((item) => item.id !== 'dashboard').map((item) => item.id)
    persistOrder(['dashboard', ...moveNavId(movableIds, fromIndex, toIndex)])
    setDragIndex(null)
    setOverIndex(null)
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-navy-800 bg-navy-900 text-white transition-[width] duration-200 ${
        collapsed ? 'w-[72px]' : 'w-60'
      }`}
    >
      <div className={`flex items-start gap-3 border-b border-navy-800 ${collapsed ? 'px-3 py-4' : 'px-4 py-5'}`}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-sm font-bold tracking-tight text-accent-soft">
          N
        </div>
        {!collapsed && (
          <div className="min-w-0 pt-0.5">
            <p className="font-brand text-[13px] leading-snug font-bold tracking-wide text-white">
              NEWPORT
            </p>
            <p className="mt-0.5 text-[10px] leading-tight tracking-[0.08em] text-accent-muted uppercase">
              Specialty Partners
            </p>
          </div>
        )}
      </div>

      <nav className="custom-scroll flex-1 overflow-y-auto px-2 py-3" aria-label="Main">
        <ul className="space-y-0.5">
          {items.map((item) => {
            const Icon = ICONS[item.id] ?? Briefcase
            const pinned = item.id === 'dashboard'
            const movableIndex = items.filter((entry) => entry.id !== 'dashboard').findIndex((entry) => entry.id === item.id)
            const isDragging = !pinned && dragIndex === movableIndex
            const isOver = !pinned && overIndex === movableIndex && dragIndex !== null && dragIndex !== movableIndex
            return (
              <li
                key={item.id}
                draggable={!pinned}
                onDragStart={pinned ? undefined : onDragStart(movableIndex)}
                onDragEnd={pinned ? undefined : onDragEnd}
                onDragOver={pinned ? undefined : onDragOver(movableIndex)}
                onDrop={pinned ? undefined : onDrop(movableIndex)}
                className={`rounded-lg transition-[box-shadow,transform,opacity] ${
                  isDragging ? 'opacity-50' : ''
                } ${isOver ? 'ring-1 ring-accent/60 ring-offset-1 ring-offset-navy-900' : ''}`}
              >
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  title={collapsed ? item.label : undefined}
                  onClick={(e) => {
                    if (didDragRef.current) {
                      e.preventDefault()
                      didDragRef.current = false
                    }
                  }}
                  className={({ isActive }) =>
                    `group flex items-center gap-2 rounded-lg px-2 py-2.5 text-[13px] transition-colors ${
                      collapsed ? 'justify-center px-2' : ''
                    } ${
                      isActive
                        ? 'bg-accent/20 font-semibold text-white shadow-[inset_3px_0_0_0_#3d7eb8]'
                        : 'text-white/70 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  {!collapsed && !pinned && (
                    <span
                      className="flex h-5 w-4 shrink-0 cursor-grab items-center justify-center text-white/30 active:cursor-grabbing group-hover:text-white/55"
                      aria-hidden
                      title="Drag to reorder"
                    >
                      <GripVertical className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </span>
                  )}
                  {!collapsed && pinned && <span className="w-4 shrink-0" aria-hidden />}
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="border-t border-navy-800 p-2">
        {!collapsed && user && (
          <p className="mb-1 truncate px-3 text-[11px] text-white/40">{user.name}</p>
        )}
        <NavLink
          to="/settings"
          title={collapsed ? 'Settings' : undefined}
          className={({ isActive }) =>
            `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition-colors ${
              collapsed ? 'justify-center px-2' : ''
            } ${
              isActive
                ? 'bg-accent/20 font-semibold text-white'
                : 'text-white/55 hover:bg-white/5 hover:text-white'
            }`
          }
        >
          <Settings className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
          {!collapsed && <span>Settings</span>}
        </NavLink>
        <button
          type="button"
          onClick={() => {
            void signOut().then(() => navigate('/login'))
          }}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] text-white/55 transition-colors hover:bg-white/5 hover:text-white ${
            collapsed ? 'justify-center px-2' : ''
          }`}
          title={collapsed ? 'Sign out' : undefined}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
          {!collapsed && <span>Sign out</span>}
        </button>
        <button
          type="button"
          onClick={onToggle}
          className={`mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] text-white/55 transition-colors hover:bg-white/5 hover:text-white ${
            collapsed ? 'justify-center px-2' : ''
          }`}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-[18px] w-[18px]" strokeWidth={1.75} />
          ) : (
            <>
              <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={1.75} />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
