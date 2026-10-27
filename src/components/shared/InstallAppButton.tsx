import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { canPromptInstall, isInstalledApp, manualInstallSteps, onInstallChange, promptInstall } from '@/lib/installApp'

/** One button that installs Newport CRM as a real desktop app (Windows, Mac, phone). */
export function InstallAppButton({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const [, force] = useState(0)
  const [note, setNote] = useState<string | null>(null)
  useEffect(() => onInstallChange(() => force((n) => n + 1)), [])

  if (isInstalledApp()) {
    return <p className={variant === 'dark' ? 'text-[11px] text-white/80' : 'text-sm text-ink-muted'}>You are using the installed Newport CRM app.</p>
  }

  const onClick = () => {
    if (!canPromptInstall()) {
      setNote(manualInstallSteps())
      return
    }
    void promptInstall().then((outcome) => {
      setNote(outcome === 'installed' ? 'Installed. Open Newport CRM from your Applications, Start menu, or Dock.' : 'Install was cancelled.')
    })
  }

  const button =
    variant === 'dark'
      ? 'inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-white/10'
      : 'inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-ink hover:bg-canvas sm:w-auto'
  return (
    <div className="flex flex-col items-center gap-1 sm:items-start">
      <button type="button" data-testid="install-app" onClick={onClick} className={button}>
        <Download className="h-4 w-4" />
        Install the Newport CRM app (Windows / Mac)
      </button>
      {note && <p className={variant === 'dark' ? 'max-w-sm text-[10px] text-white/80' : 'max-w-md text-xs text-ink-muted'}>{note}</p>}
    </div>
  )
}
