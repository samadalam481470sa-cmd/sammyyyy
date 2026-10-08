import * as XLSX from 'xlsx'
import type { Opportunity, OpportunityStatus, AcquisitionStage } from '@/types'

export type ImportRow = Record<string, string | number | null>

export type ImportDestination =
  | 'new-opportunity'
  | 'update-opportunity'
  | 'tasks'
  | 'contacts'

const HEADER_ALIASES: Record<string, string[]> = {
  projectName: ['project', 'project name', 'projectname', 'code name', 'deal name'],
  entityName: ['entity', 'entity name', 'company', 'target', 'company name'],
  status: ['status', 'deal status'],
  stage: ['stage', 'pipeline stage', 'acquisition stage'],
  dealLead: ['deal lead', 'lead', 'owner', 'deallead'],
  specialty: ['specialty', 'line', 'product'],
  geography: ['geography', 'geo', 'region', 'location'],
  nwp: ['nwp', 'written premium', 'premium'],
  netRevenue: ['net revenue', 'revenue', 'netrevenue'],
  pfEbitda: ['pf ebitda', 'ebitda', 'pfebitda'],
  nextAction: ['next action', 'action', 'nextaction'],
  nextActionDate: ['next action date', 'due', 'due date', 'action date'],
  priority: ['priority', 'prio'],
  sourceType: ['source type', 'sourcetype'],
  sourceName: ['source', 'source name', 'banker'],
  type: ['type', 'opportunity type', 'deal type'],
  name: ['name', 'contact', 'contact name'],
  title: ['title', 'role'],
  company: ['company', 'firm'],
  email: ['email', 'e-mail'],
  phone: ['phone', 'mobile'],
  action: ['action', 'task', 'description'],
  notes: ['notes', 'note', 'comments'],
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[_-]+/g, ' ')
}

function mapHeader(raw: string): string | null {
  const n = normalizeHeader(raw)
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(n) || n === field.toLowerCase()) return field
  }
  return null
}

export function parseSpreadsheet(buffer: ArrayBuffer): { headers: string[]; rows: ImportRow[] } {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return { headers: [], rows: [] }
  const sheet = workbook.Sheets[sheetName]
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  if (json.length === 0) return { headers: [], rows: [] }

  const rawHeaders = Object.keys(json[0])
  const mapped = rawHeaders.map((h) => ({ raw: h, field: mapHeader(h) }))

  const rows: ImportRow[] = json.map((row) => {
    const out: ImportRow = {}
    for (const { raw, field } of mapped) {
      const key = field ?? normalizeHeader(raw).replace(/\s+/g, '_')
      const val = row[raw]
      out[key] =
        typeof val === 'number'
          ? val
          : val == null || val === ''
            ? null
            : String(val)
    }
    return out
  })

  return {
    headers: mapped.map((m) => m.field ?? m.raw),
    rows,
  }
}

export function parseCsvText(text: string): { headers: string[]; rows: ImportRow[] } {
  const workbook = XLSX.read(text, { type: 'string' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return { headers: [], rows: [] }
  const ab = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return parseSpreadsheet(ab)
}

function asStatus(v: unknown): OpportunityStatus {
  const s = String(v ?? 'Pending')
  const allowed: OpportunityStatus[] = [
    'Active',
    'Pending',
    'Inactive',
    'Closed',
    'Declined',
    'Withdrew',
    'Completed',
  ]
  return (allowed.find((a) => a.toLowerCase() === s.toLowerCase()) ?? 'Pending') as OpportunityStatus
}

function asStage(v: unknown): AcquisitionStage {
  const s = String(v ?? 'Target Identified')
  const stages: AcquisitionStage[] = [
    'Target Identified',
    'Initial Outreach',
    'Preliminary Discussion',
    'NDA',
    'Initial Review',
    'IOI / LOI',
    'Exclusivity',
    'Due Diligence',
    'Closing',
  ]
  return (
    stages.find((a) => a.toLowerCase() === s.toLowerCase()) ?? 'Target Identified'
  )
}

function asNumber(v: unknown): number {
  if (typeof v === 'number') return v
  if (v == null || v === '') return 0
  const n = Number(String(v).replace(/[$,]/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** Map a spreadsheet row into a partial Opportunity for autofill / create. */
export function rowToOpportunityDraft(row: ImportRow, index: number): Partial<Opportunity> {
  const projectName =
    String(row.projectName ?? row.project_name ?? `Imported Project ${index + 1}`)
  const entityName = String(row.entityName ?? row.entity_name ?? row.company ?? 'Unknown Entity')
  return {
    projectName,
    entityName,
    type: (String(row.type ?? 'Platform Acquisition') as Opportunity['type']),
    status: asStatus(row.status),
    stage: asStage(row.stage),
    dealLead: String(row.dealLead ?? row.deal_lead ?? 'Dennis DiCapua'),
    sourceType: (String(row.sourceType ?? row.source_type ?? 'Other') as Opportunity['sourceType']),
    sourceName: String(row.sourceName ?? row.source_name ?? 'Excel import'),
    specialty: String(row.specialty ?? 'Specialty'),
    geography: String(row.geography ?? 'US'),
    nwp: asNumber(row.nwp),
    netRevenue: asNumber(row.netRevenue ?? row.net_revenue),
    pfEbitda: asNumber(row.pfEbitda ?? row.pf_ebitda),
    nextAction: row.nextAction != null ? String(row.nextAction) : 'Review imported data',
    nextActionDate:
      row.nextActionDate != null ? String(row.nextActionDate) : new Date().toISOString().slice(0, 10),
    priority: (['A', 'B', 'C'].includes(String(row.priority ?? 'B'))
      ? String(row.priority ?? 'B')
      : 'B') as Opportunity['priority'],
    needsAttention: false,
    attentionReasons: [],
    outstandingItems: [],
    diligenceNotes: `Imported from Excel on ${new Date().toLocaleDateString()}`,
  }
}
