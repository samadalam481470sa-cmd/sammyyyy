import { Component, type ErrorInfo, type ReactNode } from 'react'
import { rememberClientLog } from '@/lib/clientLog'

interface Props {
  children: ReactNode
}

interface State {
  message: string | null
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { message: null }

  static getDerivedStateFromError(error: Error): State {
    return { message: error.message || 'The dashboard hit an unexpected error.' }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    rememberClientLog(`${error.message} ${info.componentStack ?? ''}`.trim())
  }

  render() {
    if (!this.state.message) return this.props.children
    return (
      <div className="grid min-h-full place-items-center bg-[#040b16] px-6 text-white">
        <div className="max-w-md rounded-2xl border border-white/10 bg-[#0b1f3a] p-6">
          <h1 className="font-brand text-2xl font-semibold">Newport CRM needs a reload</h1>
          <p className="mt-2 text-sm text-white/70">
            This screen was kept so the rest of the app can be fixed in Cursor. Your Microsoft password was not stored.
          </p>
          <button
            type="button"
            className="mt-4 h-10 rounded-lg bg-white px-4 text-sm font-semibold text-[#0b1f3a]"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
