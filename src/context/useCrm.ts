import { useContext } from "react"
import { CrmContext, type CrmContextValue } from "./crm-context.ts"

export function useCrm(): CrmContextValue {
  const value = useContext(CrmContext)
  if (!value) throw new Error("useCrm must be used within CrmProvider")
  return value
}
