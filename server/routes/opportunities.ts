import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db/index.ts'
import { requireAuth, requireRole, writeAudit, recordChange } from '../middleware/security.ts'
import { rowToOpportunity, type DbOpportunityRow } from '../mappers.ts'

export const opportunitiesRouter = Router()

opportunitiesRouter.use(requireAuth)

opportunitiesRouter.get('/', (_req, res) => {
  const rows = db
    .prepare(`SELECT * FROM opportunities ORDER BY project_number ASC`)
    .all() as DbOpportunityRow[]
  res.json(rows.map(rowToOpportunity))
})

opportunitiesRouter.get('/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM opportunities WHERE id = ?`).get(req.params.id) as
    | DbOpportunityRow
    | undefined
  if (!row) return res.status(404).json({ error: 'Opportunity not found' })
  res.json(rowToOpportunity(row))
})

const updateSchema = z.object({
  projectName: z.string().min(1).max(120).optional(),
  entityName: z.string().min(1).max(200).optional(),
  type: z.string().min(1).optional(),
  status: z
    .enum(['Active', 'Pending', 'Inactive', 'Closed', 'Declined', 'Withdrew', 'Completed'])
    .optional(),
  stage: z.string().min(1).optional(),
  dealLead: z.string().max(120).optional(),
  sourceType: z.string().optional(),
  sourceName: z.string().optional(),
  specialty: z.string().optional(),
  geography: z.string().optional(),
  nwp: z.number().nonnegative().optional(),
  netRevenue: z.number().nonnegative().optional(),
  pfEbitda: z.number().optional(),
  nextAction: z.string().nullable().optional(),
  nextActionDate: z.string().nullable().optional(),
  priority: z.enum(['A', 'B', 'C']).optional(),
  needsAttention: z.boolean().optional(),
  attentionReasons: z.array(z.string()).optional(),
  outstandingItems: z.array(z.string()).optional(),
  diligenceNotes: z.string().max(5000).optional(),
})

const createSchema = updateSchema.required({
  projectName: true,
  entityName: true,
})

opportunitiesRouter.post('/', requireRole('admin', 'partner', 'analyst'), (req, res) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid create payload', details: parsed.error.flatten() })
  }
  const data = parsed.data
  const maxRow = db
    .prepare(`SELECT COALESCE(MAX(project_number), 0) AS m FROM opportunities`)
    .get() as { m: number }
  const projectNumber = maxRow.m + 1
  const id = `opp_import_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

  db.prepare(
    `INSERT INTO opportunities (
      id, project_number, project_name, entity_name, type, status, stage,
      deal_lead, source_type, source_name, specialty, geography,
      nwp, net_revenue, pf_ebitda, next_action, next_action_date,
      priority, last_activity_date, needs_attention, attention_reasons,
      outstanding_items, diligence_notes
    ) VALUES (
      @id, @project_number, @project_name, @entity_name, @type, @status, @stage,
      @deal_lead, @source_type, @source_name, @specialty, @geography,
      @nwp, @net_revenue, @pf_ebitda, @next_action, @next_action_date,
      @priority, datetime('now'), @needs_attention, @attention_reasons,
      @outstanding_items, @diligence_notes
    )`,
  ).run({
    id,
    project_number: projectNumber,
    project_name: data.projectName,
    entity_name: data.entityName,
    type: data.type ?? 'Platform Acquisition',
    status: data.status ?? 'Pending',
    stage: data.stage ?? 'Target Identified',
    deal_lead: data.dealLead ?? '',
    source_type: data.sourceType ?? 'Other',
    source_name: data.sourceName ?? 'Excel import',
    specialty: data.specialty ?? '',
    geography: data.geography ?? '',
    nwp: data.nwp ?? 0,
    net_revenue: data.netRevenue ?? 0,
    pf_ebitda: data.pfEbitda ?? 0,
    next_action: data.nextAction ?? 'Review imported data',
    next_action_date: data.nextActionDate ?? null,
    priority: data.priority ?? 'B',
    needs_attention: data.needsAttention ? 1 : 0,
    attention_reasons: JSON.stringify(data.attentionReasons ?? []),
    outstanding_items: JSON.stringify(data.outstandingItems ?? []),
    diligence_notes: data.diligenceNotes ?? '',
  })

  const row = db.prepare(`SELECT * FROM opportunities WHERE id = ?`).get(id) as DbOpportunityRow
  writeAudit(
    req.auth!.userId,
    req.auth!.userName,
    'opportunity.create',
    'opportunity',
    id,
    `Created ${data.projectName}`,
    req,
  )
  recordChange(req, 'opportunity', id, 'create', null, row as unknown as Record<string, unknown>)
  res.status(201).json(rowToOpportunity(row))
})

opportunitiesRouter.patch('/:id', requireRole('admin', 'partner', 'analyst'), (req, res) => {
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid update payload', details: parsed.error.flatten() })
  }

  const existing = db.prepare(`SELECT * FROM opportunities WHERE id = ?`).get(req.params.id) as
    | DbOpportunityRow
    | undefined
  if (!existing) return res.status(404).json({ error: 'Opportunity not found' })

  const data = parsed.data
  const next = {
    project_name: data.projectName ?? existing.project_name,
    entity_name: data.entityName ?? existing.entity_name,
    type: data.type ?? existing.type,
    status: data.status ?? existing.status,
    stage: data.stage ?? existing.stage,
    deal_lead: data.dealLead ?? existing.deal_lead,
    source_type: data.sourceType ?? existing.source_type,
    source_name: data.sourceName ?? existing.source_name,
    specialty: data.specialty ?? existing.specialty,
    geography: data.geography ?? existing.geography,
    nwp: data.nwp ?? existing.nwp,
    net_revenue: data.netRevenue ?? existing.net_revenue,
    pf_ebitda: data.pfEbitda ?? existing.pf_ebitda,
    next_action: data.nextAction !== undefined ? data.nextAction : existing.next_action,
    next_action_date:
      data.nextActionDate !== undefined ? data.nextActionDate : existing.next_action_date,
    priority: data.priority ?? existing.priority,
    needs_attention:
      data.needsAttention !== undefined ? (data.needsAttention ? 1 : 0) : existing.needs_attention,
    attention_reasons:
      data.attentionReasons !== undefined
        ? JSON.stringify(data.attentionReasons)
        : existing.attention_reasons,
    outstanding_items:
      data.outstandingItems !== undefined
        ? JSON.stringify(data.outstandingItems)
        : existing.outstanding_items,
    diligence_notes: data.diligenceNotes ?? existing.diligence_notes,
  }

  db.prepare(
    `UPDATE opportunities SET
      project_name = @project_name,
      entity_name = @entity_name,
      type = @type,
      status = @status,
      stage = @stage,
      deal_lead = @deal_lead,
      source_type = @source_type,
      source_name = @source_name,
      specialty = @specialty,
      geography = @geography,
      nwp = @nwp,
      net_revenue = @net_revenue,
      pf_ebitda = @pf_ebitda,
      next_action = @next_action,
      next_action_date = @next_action_date,
      priority = @priority,
      needs_attention = @needs_attention,
      attention_reasons = @attention_reasons,
      outstanding_items = @outstanding_items,
      diligence_notes = @diligence_notes,
      last_activity_date = datetime('now'),
      updated_at = datetime('now')
     WHERE id = @id`,
  ).run({ ...next, id: req.params.id })

  const updated = db.prepare(`SELECT * FROM opportunities WHERE id = ?`).get(req.params.id) as DbOpportunityRow

  writeAudit(
    req.auth!.userId,
    req.auth!.userName,
    'opportunity.update',
    'opportunity',
    req.params.id,
    `Updated fields: ${Object.keys(data).join(', ')}`,
    req,
  )
  recordChange(
    req,
    'opportunity',
    req.params.id,
    'update',
    existing as unknown as Record<string, unknown>,
    updated as unknown as Record<string, unknown>,
  )

  res.json(rowToOpportunity(updated))
})
