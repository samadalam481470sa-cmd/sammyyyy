import { Hammer } from 'lucide-react'

interface PlaceholderPageProps {
  moduleName: string
}

export function PlaceholderPage({ moduleName }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-[4px] border border-line bg-white text-brand-500 shadow-[0_2px_2px_rgba(0,0,0,0.05)]">
        <Hammer className="h-6 w-6" />
      </div>
      <h2 className="mt-5 text-lg font-bold text-ink">{moduleName}</h2>
      <p className="mt-2 max-w-md text-[13px] text-muted">
        This module is planned for a future sprint. The navigation shell is in place so it can be
        added without restructuring the application.
      </p>
    </div>
  )
}
