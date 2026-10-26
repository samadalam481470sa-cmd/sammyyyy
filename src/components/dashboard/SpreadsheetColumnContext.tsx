import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '@/auth/AuthContext'
import {
  createDashboardSheet,
  loadDashboardSheets,
  nextSpreadsheetIndex,
  saveDashboardSheets,
  updateSheetCell,
  updateSheetHeader,
  type DashboardSheet,
  type SheetGrid,
} from '@/lib/dashboardSpreadsheets'
import { sessionOwnerKey } from '@/lib/ownerKey'
import { registerVaultFlush } from '@/lib/userVault'

interface SpreadsheetColumnContextValue {
  sheets: DashboardSheet[]
  addSheet: (grid: SheetGrid, sourceName: string) => void
  editCell: (id: string, rowIndex: number, columnIndex: number, value: string) => void
  editHeader: (id: string, columnIndex: number, value: string) => void
  removeSheet: (id: string) => void
}

const SpreadsheetColumnContext = createContext<SpreadsheetColumnContextValue | null>(null)

export function SpreadsheetColumnProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const owner = sessionOwnerKey(user)
  const [sheets, setSheets] = useState<DashboardSheet[]>(() => loadDashboardSheets(owner))
  const sheetsRef = useRef(sheets)
  sheetsRef.current = sheets

  useEffect(() => {
    setSheets(loadDashboardSheets(owner))
  }, [owner])

  useEffect(() => {
    return registerVaultFlush(() => {
      saveDashboardSheets(owner, sheetsRef.current)
    })
  }, [owner])

  const write = useCallback(
    (recipe: (prev: DashboardSheet[]) => DashboardSheet[]) => {
      setSheets((prev) => {
        const next = recipe(prev)
        saveDashboardSheets(owner, next)
        return next
      })
    },
    [owner],
  )

  const value = useMemo<SpreadsheetColumnContextValue>(
    () => ({
      sheets,
      addSheet: (grid, sourceName) => {
        write((prev) => [...prev, createDashboardSheet(grid, nextSpreadsheetIndex(prev), sourceName)])
      },
      editCell: (id, rowIndex, columnIndex, cell) => {
        write((prev) =>
          prev.map((sheet) => (sheet.id === id ? updateSheetCell(sheet, rowIndex, columnIndex, cell) : sheet)),
        )
      },
      editHeader: (id, columnIndex, header) => {
        write((prev) => prev.map((sheet) => (sheet.id === id ? updateSheetHeader(sheet, columnIndex, header) : sheet)))
      },
      removeSheet: (id) => {
        write((prev) => prev.filter((sheet) => sheet.id !== id))
      },
    }),
    [sheets, write],
  )

  return <SpreadsheetColumnContext.Provider value={value}>{children}</SpreadsheetColumnContext.Provider>
}

export function useSpreadsheetColumns(): SpreadsheetColumnContextValue {
  const value = useContext(SpreadsheetColumnContext)
  if (!value) {
    throw new Error('Spreadsheet columns are only available inside the signed-in app.')
  }
  return value
}
