import * as XLSX from 'xlsx'
import type { Opportunity, OpportunityStatus, AcquisitionStage } from '@/types'

export type ImportRow = Record<string, string | number | null>

export type ImportDestination =
  | 'new-opportunity'
  | 'update-opportunity'
  | 'tasks'
  | 'contacts'

/** Canonical CRM fields we can autofill from a sheet. */
export const CRM_FIELD_LABELS: Record<string, string> = {
  projectName: 'Project name',
  entityName: 'Entity / company',
  type: 'Opportunity type',
  status: 'Status',
  stage: 'Stage',
  dealLead: 'Deal lead',
  sourceType: 'Source type',
  sourceName: 'Source name',
  specialty: 'Specialty',
  geography: 'Geography',
  nwp: 'NWP',
  netRevenue: 'Net revenue',
  pfEbitda: 'PF EBITDA',
  nextAction: 'Next action',
  nextActionDate: 'Next action date',
  priority: 'Priority',
  diligenceNotes: 'Diligence notes',
  name: 'Contact name',
  title: 'Title / role',
  company: 'Company',
  email: 'Email',
  phone: 'Phone',
  action: 'Task action',
  notes: 'Notes',
  owner: 'Owner',
}

const HEADER_ALIASES: Record<string, string[]> = {
  projectName: [
    'project',
    'project name',
    'projectname',
    'code name',
    'codename',
    'deal name',
    'deal',
    'opportunity',
    'opportunity name',
  ],
  entityName: [
    'entity',
    'entity name',
    'company',
    'target',
    'company name',
    'target company',
    'legal name',
    'insured',
  ],
  status: ['status', 'deal status', 'opp status', 'pipeline status'],
  stage: ['stage', 'pipeline stage', 'acquisition stage', 'deal stage'],
  dealLead: ['deal lead', 'lead', 'owner', 'deallead', 'deal owner', 'rm', 'relationship manager'],
  specialty: ['specialty', 'line', 'product', 'line of business', 'lob', 'coverage'],
  geography: ['geography', 'geo', 'region', 'location', 'state', 'territory', 'market'],
  nwp: [
    'nwp',
    'written premium',
    'net written premium',
    'premium',
    'gwp',
    'gross written premium',
    'nwp ($)',
    'nwp$',
  ],
  netRevenue: [
    'net revenue',
    'revenue',
    'netrevenue',
    'net rev',
    'commission',
    'fee income',
    'revenue ($)',
  ],
  pfEbitda: [
    'pf ebitda',
    'ebitda',
    'pfebitda',
    'pro forma ebitda',
    'adj ebitda',
    'adjusted ebitda',
    'ebitda ($)',
  ],
  nextAction: ['next action', 'action', 'nextaction', 'next step', 'follow up', 'follow-up'],
  nextActionDate: [
    'next action date',
    'due',
    'due date',
    'action date',
    'follow up date',
    'deadline',
  ],
  priority: ['priority', 'prio', 'rank'],
  sourceType: ['source type', 'sourcetype', 'origin type'],
  sourceName: ['source', 'source name', 'banker', 'broker', 'intermediary'],
  type: ['type', 'opportunity type', 'deal type', 'transaction type'],
  diligenceNotes: ['diligence', 'diligence notes', 'notes', 'comments', 'memo'],
  name: ['name', 'contact', 'contact name', 'full name', 'person'],
  title: ['title', 'role', 'job title', 'position'],
  company: ['company', 'firm', 'organization', 'employer'],
  email: ['email', 'e-mail', 'email address', 'mail'],
  phone: ['phone', 'mobile', 'telephone', 'cell', 'phone number', 'tel'],
  action: ['action', 'task', 'description', 'task name', 'to do', 'todo'],
  notes: ['notes', 'note', 'comments', 'comment', 'remark'],
  owner: ['owner', 'assignee', 'assigned to'],
}

export interface ColumnMapping {
  rawHeader: string
  field: string | null
  label: string | null
  matched: boolean
  sample: string
}

export interface SpreadsheetAnalysis {
  headers: string[]
  rows: ImportRow[]
  columns: ColumnMapping[]
  matchedFields: string[]
  unmatchedHeaders: string[]
  /** CRM opportunity fields that got a real value from row 0 */
  filledFields: string[]
  /** Important opportunity fields still empty after mapping row 0 */
  missingFields: string[]
}

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[$€£¥]/g, '')
    .replace(/[()]/g, ' ')
    .replace(/[_./\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function fuzzyScore(normalized: string, alias: string): number {
  if (normalized === alias) return 100
  if (normalized.startsWith(alias) || alias.startsWith(normalized)) return 80
  if (normalized.includes(alias) || alias.includes(normalized)) return 60
  // token overlap
  const a = new Set(normalized.split(' '))
  const b = alias.split(' ')
  const hit = b.filter((t) => a.has(t)).length
  if (hit > 0) return 40 + hit * 10
  return 0
}

export function mapHeader(raw: string): string | null {
  const n = normalizeHeader(raw)
  if (!n) return null
  let best: { field: string; score: number } | null = null
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      const score = fuzzyScore(n, alias)
      if (score >= 60 && (!best || score > best.score)) {
        best = { field, score }
      }
    }
    if (n === field.toLowerCase()) return field
  }
  return best?.field ?? null
}

function cellString(val: unknown): string {
  if (val == null || val === '') return ''
  if (typeof val === 'number') return String(val)
  return String(val)
}

export function parseSpreadsheet(buffer: ArrayBuffer): SpreadsheetAnalysis {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    return emptyAnalysis()
  }
  const sheet = workbook.Sheets[sheetName]
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  })
  return analyzeRows(json)
}

export function parseCsvText(text: string): SpreadsheetAnalysis {
  const workbook = XLSX.read(text.trim(), { type: 'string' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return emptyAnalysis()
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
    defval: '',
    raw: false,
  })
  return analyzeRows(json)
}

/** Paste from Excel clipboard (TSV / CSV). */
export function parseClipboardText(text: string): SpreadsheetAnalysis {
  const trimmed = text.trim()
  if (!trimmed) return emptyAnalysis()
  // Prefer sheet_to_json via XLSX for robust CSV/TSV
  try {
    return parseCsvText(trimmed)
  } catch {
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim())
    if (lines.length < 2) return emptyAnalysis()
    const delim = lines[0].includes('\t') ? '\t' : ','
    const headers = lines[0].split(delim).map((h) => h.trim())
    const json = lines.slice(1).map((line) => {
      const cells = line.split(delim)
      const row: Record<string, unknown> = {}
      headers.forEach((h, i) => {
        row[h] = cells[i]?.trim() ?? ''
      })
      return row
    })
    return analyzeRows(json)
  }
}

function emptyAnalysis(): SpreadsheetAnalysis {
  return {
    headers: [],
    rows: [],
    columns: [],
    matchedFields: [],
    unmatchedHeaders: [],
    filledFields: [],
    missingFields: [],
  }
}

function analyzeRows(json: Record<string, unknown>[]): SpreadsheetAnalysis {
  if (json.length === 0) return emptyAnalysis()

  const rawHeaders = Object.keys(json[0])
  const columns: ColumnMapping[] = rawHeaders.map((raw) => {
    const field = mapHeader(raw)
    const sampleVal = json[0]?.[raw]
    return {
      rawHeader: raw,
      field,
      label: field ? CRM_FIELD_LABELS[field] ?? field : null,
      matched: Boolean(field),
      sample: cellString(sampleVal).slice(0, 80),
    }
  })

  // Prefer first matching column when duplicates map to same field
  const claimed = new Set<string>()
  for (const col of columns) {
    if (col.field && claimed.has(col.field)) {
      col.field = null
      col.label = null
      col.matched = false
    } else if (col.field) {
      claimed.add(col.field)
    }
  }

  const rows: ImportRow[] = json.map((row) => {
    const out: ImportRow = {}
    for (const col of columns) {
      const key = col.field ?? `__unmatched__${normalizeHeader(col.rawHeader).replace(/\s+/g, '_')}`
      const val = row[col.rawHeader]
      if (col.field && isNumericField(col.field)) {
        out[key] = asNumber(val)
      } else if (typeof val === 'number') {
        out[key] = val
      } else if (val == null || val === '') {
        out[key] = null
      } else {
        out[key] = String(val)
      }
      // Always keep raw unmatched accessible
      if (!col.matched) {
        out[`__raw__${col.rawHeader}`] = cellString(val) || null
      }
    }
    return out
  })

  const matchedFields = columns.filter((c) => c.matched && c.field).map((c) => c.field!) 
  const unmatchedHeaders = columns.filter((c) => !c.matched).map((c) => c.rawHeader)

  const draft = rowToOpportunityDraft(rows[0] ?? {}, 0, { onlyMapped: true })
  const filledFields = Object.keys(draft)
  const important = [
    'projectName',
    'entityName',
    'status',
    'stage',
    'dealLead',
    'nwp',
    'netRevenue',
    'pfEbitda',
    'specialty',
    'geography',
  ]
  const missingFields = important.filter((f) => !filledFields.includes(f))

  return {
    headers: columns.map((c) => c.field ?? c.rawHeader),
    rows,
    columns,
    matchedFields,
    unmatchedHeaders,
    filledFields,
    missingFields,
  }
}

function isNumericField(field: string): boolean {
  return field === 'nwp' || field === 'netRevenue' || field === 'pfEbitda'
}

function asStatus(v: unknown): OpportunityStatus | undefined {
  if (v == null || v === '') return undefined
  const s = String(v)
  const allowed: OpportunityStatus[] = [
    'Active',
    'Pending',
    'Inactive',
    'Closed',
    'Declined',
    'Withdrew',
    'Completed',
  ]
  return allowed.find((a) => a.toLowerCase() === s.toLowerCase())
}

function asStage(v: unknown): AcquisitionStage | undefined {
  if (v == null || v === '') return undefined
  const s = String(v)
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
  const exact = stages.find((a) => a.toLowerCase() === s.toLowerCase())
  if (exact) return exact
  return stages.find((a) => a.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(a.toLowerCase().slice(0, 6)))
}

export function asNumber(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (v == null || v === '') return 0
  const n = Number(String(v).replace(/[$,£€\s]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function hasValue(v: unknown): boolean {
  return v != null && v !== ''
}

/**
 * Map a spreadsheet row into a partial Opportunity.
 * onlyMapped=true → omit fields the sheet did not provide (safe for updates).
 */
export function rowToOpportunityDraft(
  row: ImportRow,
  index: number,
  opts: { onlyMapped?: boolean } = {},
): Partial<Opportunity> {
  const only = Boolean(opts.onlyMapped)
  const out: Partial<Opportunity> = {}

  if (hasMappedSource(row, 'projectName')) {
    out.projectName = String(row.projectName ?? row.project_name)
  } else if (!only) {
    out.projectName = `Imported Project ${index + 1}`
  }

  if (hasMappedSource(row, 'entityName') || hasMappedSource(row, 'company')) {
    out.entityName = String(row.entityName ?? row.entity_name ?? row.company ?? '')
  } else if (!only) {
    out.entityName = 'Unknown Entity'
  }

  if (hasMappedSource(row, 'type')) {
    out.type = String(row.type) as Opportunity['type']
  } else if (!only) {
    out.type = 'Platform Acquisition'
  }

  if (hasMappedSource(row, 'status')) {
    out.status = asStatus(row.status) ?? 'Pending'
  } else if (!only) {
    out.status = 'Pending'
  }

  if (hasMappedSource(row, 'stage')) {
    out.stage = asStage(row.stage) ?? 'Target Identified'
  } else if (!only) {
    out.stage = 'Target Identified'
  }

  if (hasMappedSource(row, 'dealLead') || hasMappedSource(row, 'owner')) {
    out.dealLead = String(row.dealLead ?? row.deal_lead ?? row.owner ?? '')
  } else if (!only) {
    out.dealLead = 'Dennis DiCapua'
  }

  if (hasMappedSource(row, 'sourceType')) {
    out.sourceType = String(row.sourceType ?? row.source_type) as Opportunity['sourceType']
  } else if (!only) {
    out.sourceType = 'Other'
  }

  if (hasMappedSource(row, 'sourceName')) {
    out.sourceName = String(row.sourceName ?? row.source_name ?? '')
  } else if (!only) {
    out.sourceName = 'Excel import'
  }

  if (hasMappedSource(row, 'specialty')) {
    out.specialty = String(row.specialty ?? '')
  } else if (!only) {
    out.specialty = 'Specialty'
  }

  if (hasMappedSource(row, 'geography')) {
    out.geography = String(row.geography ?? '')
  } else if (!only) {
    out.geography = 'US'
  }

  if (hasMappedSource(row, 'nwp')) out.nwp = asNumber(row.nwp)
  else if (!only) out.nwp = 0

  if (hasMappedSource(row, 'netRevenue')) out.netRevenue = asNumber(row.netRevenue ?? row.net_revenue)
  else if (!only) out.netRevenue = 0

  if (hasMappedSource(row, 'pfEbitda')) out.pfEbitda = asNumber(row.pfEbitda ?? row.pf_ebitda)
  else if (!only) out.pfEbitda = 0

  if (hasMappedSource(row, 'nextAction')) {
    out.nextAction = row.nextAction != null ? String(row.nextAction) : null
  } else if (!only) {
    out.nextAction = 'Review imported data'
  }

  if (hasMappedSource(row, 'nextActionDate')) {
    out.nextActionDate = row.nextActionDate != null ? String(row.nextActionDate).slice(0, 10) : null
  } else if (!only) {
    out.nextActionDate = new Date().toISOString().slice(0, 10)
  }

  if (hasMappedSource(row, 'priority')) {
    const p = String(row.priority ?? 'B')
    out.priority = (['A', 'B', 'C'].includes(p) ? p : 'B') as Opportunity['priority']
  } else if (!only) {
    out.priority = 'B'
  }

  if (hasMappedSource(row, 'diligenceNotes') || hasMappedSource(row, 'notes')) {
    out.diligenceNotes = String(row.diligenceNotes ?? row.notes ?? '')
  } else if (!only) {
    out.diligenceNotes = `Imported from Excel on ${new Date().toLocaleDateString()}`
  }

  if (!only) {
    out.needsAttention = false
    out.attentionReasons = []
    out.outstandingItems = []
  }

  return out
}

function hasMappedSource(row: ImportRow, field: string): boolean {
  if (Object.prototype.hasOwnProperty.call(row, field) && hasValue(row[field])) return true
  // snake variants
  const snake = field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
  if (snake !== field && Object.prototype.hasOwnProperty.call(row, snake) && hasValue(row[snake])) {
    return true
  }
  if (field === 'entityName' && hasValue(row.company)) return true
  if (field === 'dealLead' && hasValue(row.owner)) return true
  return false
}

/** Human-readable mapping rows for the UI. */
export function describeMapping(analysis: SpreadsheetAnalysis): {
  mapped: { excel: string; crm: string; sample: string }[]
  unmatched: { excel: string; sample: string }[]
  missing: string[]
} {
  return {
    mapped: analysis.columns
      .filter((c) => c.matched && c.field && c.label)
      .map((c) => ({ excel: c.rawHeader, crm: c.label!, sample: c.sample })),
    unmatched: analysis.columns
      .filter((c) => !c.matched)
      .map((c) => ({ excel: c.rawHeader, sample: c.sample })),
    missing: analysis.missingFields.map((f) => CRM_FIELD_LABELS[f] ?? f),
  }
}
