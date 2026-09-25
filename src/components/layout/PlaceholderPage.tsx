import { Hammer } from 'lucide-react'

interface PlaceholderPageProps {
  moduleName: string
}

export function PlaceholderPage({ moduleName }: PlaceholderPageProps) {
  return (
    <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-center px-6 py-24 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-50 text-navy-600 ring-1 ring-navy-100">
        <Hammer className="h-6 w-6" />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-navy-900">{moduleName}</h2>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        This module is planned for a future sprint. The navigation shell is in place so it can be
        added without restructuring the application.
      </p>
    </div>
  )
}
