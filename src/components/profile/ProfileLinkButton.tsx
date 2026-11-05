import { ExternalLink } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useEditorGuard } from '@/components/shared/EditorGuardContext'

interface ProfileLinkButtonProps {
  opportunityId: string | null | undefined
  /** Shown when there is no linked opportunity. */
  missingText?: string
  className?: string
  onNavigate?: () => void
  /** Profile tab to open. Omitted = Overview. */
  tab?: 'tasks' | 'relationships' | 'documents' | 'meetings' | 'activity'
  /** Record to highlight on that tab, for example `task=abc`. */
  focus?: Record<string, string>
}

export function opportunityProfilePath(id: string): string {
  return `/opportunities/${encodeURIComponent(id)}`
}

/** "View Full Opportunity Profile" — navigates by stable opportunity id, respecting unsaved-change guards. */
export function ProfileLinkButton({ opportunityId, missingText = 'No linked opportunity', className = '', onNavigate, tab, focus }: ProfileLinkButtonProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const guard = useEditorGuard()
  if (!opportunityId) {
    return (
      <div className={className}>
        <button type="button" disabled className="h-10 w-full cursor-not-allowed rounded-lg border border-border bg-white text-sm font-semibold text-ink-subtle">
          View Full Opportunity Profile
        </button>
        <p className="mt-1 text-center text-[11px] text-ink-muted">{missingText}</p>
      </div>
    )
  }
  const go = () => {
    onNavigate?.()
    const query = new URLSearchParams({ ...(tab ? { tab } : {}), ...(focus ?? {}) }).toString()
    navigate(`${opportunityProfilePath(opportunityId)}${query ? `?${query}` : ''}`, { state: { from: `${location.pathname}${location.search}` } })
  }
  return (
    <button
      type="button"
      data-testid="view-full-profile"
      onClick={() => (guard ? guard.guardAction(go) : go())}
      className={`inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-navy-900 bg-surface text-sm font-semibold text-navy-900 hover:bg-accent-soft ${className}`}
    >
      <ExternalLink className="h-4 w-4" />
      View Full Opportunity Profile
    </button>
  )
}
