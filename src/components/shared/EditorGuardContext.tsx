import { createContext, useContext, useMemo, useRef, type MouseEvent, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export interface OpportunityEditorHandle {
  isDirty: () => boolean
  requestLeave: (next: () => void) => void
}

interface EditorGuardValue {
  register: (handle: OpportunityEditorHandle | null) => void
  guardClick: (event: MouseEvent, to: string) => void
  guardAction: (run: () => void) => void
}

const EditorGuardContext = createContext<EditorGuardValue | null>(null)

export function EditorGuardProvider({ children }: { children: ReactNode }) {
  const handleRef = useRef<OpportunityEditorHandle | null>(null)
  const navigate = useNavigate()
  const location = useLocation()

  const value = useMemo<EditorGuardValue>(
    () => ({
      register: (handle) => {
        handleRef.current = handle
      },
      guardAction: (run) => {
        const handle = handleRef.current
        if (!handle?.isDirty()) {
          run()
          return
        }
        handle.requestLeave(run)
      },
      guardClick: (event, to) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
          return
        }
        const nextPath = to.split('?')[0] || '/'
        if (location.pathname === nextPath) return
        const handle = handleRef.current
        if (!handle?.isDirty()) return
        event.preventDefault()
        handle.requestLeave(() => navigate(to))
      },
    }),
    [location.pathname, navigate],
  )

  return <EditorGuardContext.Provider value={value}>{children}</EditorGuardContext.Provider>
}

export function useEditorGuard() {
  return useContext(EditorGuardContext)
}
