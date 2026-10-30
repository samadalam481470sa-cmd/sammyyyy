/**
 * Newport AI — site-wide assistant.
 * Retrieves across opportunities/tasks/contacts/etc. and synthesizes answers.
 * When OPENAI_API_KEY (server) is present, the API route upgrades to LLM.
 */

import type { Opportunity } from '@/types'

export interface AiKnowledge {
  opportunities: Opportunity[]
  tasks?: Array<Record<string, unknown>>
  contacts?: Array<Record<string, unknown>>
  documents?: Array<Record<string, unknown>>
  sources?: Array<Record<string, unknown>>
  carriers?: Array<Record<string, unknown>>
  portfolio?: Array<Record<string, unknown>>
}

export interface AiAnswer {
  answer: string
  sources: Array<{ type: string; id: string; label: string }>
  mode: 'retrieval' | 'llm'
}

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^\w\s/$]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !['the', 'and', 'for', 'with', 'what', 'which', 'show', 'about', 'this', 'that', 'from', 'have', 'does'].includes(t))
}

function scoreText(hay: string, tokens: string[]): number {
  const h = hay.toLowerCase()
  let score = 0
  for (const t of tokens) {
    if (h.includes(t)) score += t.length > 4 ? 2 : 1
  }
  return score
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

export interface ProjectMention {
  /** Exact text the user typed, e.g. "Project B" or "DEAL-043". */
  text: string
  match: Opportunity | null
}

function dealIdOf(o: Opportunity): string | null {
  return typeof o.projectNumber === 'number' ? `DEAL-${String(o.projectNumber).padStart(3, '0')}` : null
}

/**
 * Projects named in the question, matched exactly by project name or deal ID (case-insensitive).
 * "Project B" never matches Project BA, and an unknown name is reported as unknown.
 */
export function findMentionedProjects(question: string, opps: Opportunity[]): ProjectMention[] {
  const out: ProjectMention[] = []
  const seen = new Set<string>()
  const byName = new Map(opps.map((o) => [o.projectName.trim().toLowerCase(), o]))
  // Longest names first so "Project Gladiator Two" wins over "Project Gladiator".
  const names = [...byName.keys()].filter(Boolean).sort((a, b) => b.length - a.length)
  const lower = question.toLowerCase()
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'i').test(lower)) {
      const o = byName.get(name)!
      if (!seen.has(o.id)) {
        seen.add(o.id)
        out.push({ text: o.projectName, match: o })
      }
    }
  }
  for (const m of question.matchAll(/\bdeal[-\s]?(\d{1,4})\b/gi)) {
    const n = Number(m[1])
    const o = opps.find((row) => row.projectNumber === n) ?? null
    if (o && seen.has(o.id)) continue
    if (o) seen.add(o.id)
    out.push({ text: m[0].toUpperCase(), match: o })
  }
  // "Project X" phrases that did not match any saved project name.
  for (const m of question.matchAll(/\bproject\s+([a-z0-9][a-z0-9-]*)/gi)) {
    const text = `Project ${m[1]}`
    const known = byName.get(text.toLowerCase())
    if (!known && !out.some((row) => row.text.toLowerCase() === text.toLowerCase())) {
      out.push({ text, match: null })
    }
  }
  return out
}

function taskLinesFor(o: Opportunity, tasks: Array<Record<string, unknown>>): string[] {
  return tasks
    .filter((t) => t.opportunityId === o.id && !t.deletedAt && !t.archivedAt && (t.status === 'Open' || t.status === 'In Progress'))
    .sort((a, b) => String(a.dueDate ?? '9999').localeCompare(String(b.dueDate ?? '9999')))
    .map((t) => `  – ${String(t.action ?? 'Task')} · due ${String(t.dueDate ?? 'no date')} · ${String(t.owner ?? 'unassigned')} · priority ${String(t.priority ?? '—')}`)
}

export function summarizeProject(o: Opportunity, knowledge: AiKnowledge): string {
  const open = taskLinesFor(o, knowledge.tasks ?? [])
  const attention = o.needsAttention ? `Needs Attention: ${(o.attentionReasons ?? []).join('; ')}` : 'No attention flag'
  return [
    `**${o.projectName}** (${o.entityName})${dealIdOf(o) ? ` · ${dealIdOf(o)}` : ''}`,
    '',
    `• Status: **${o.status}** · Stage: **${o.stage}**`,
    `• Deal lead: ${o.dealLead || 'Unassigned'}`,
    `• Specialty / Geography: ${o.specialty || '—'} · ${o.geography || '—'}`,
    `• NWP ${fmtMoney(o.nwp)} · Net Revenue ${fmtMoney(o.netRevenue)} · PF EBITDA ${fmtMoney(o.pfEbitda)}`,
    `• Next action: ${o.nextAction ? `${o.nextAction} (due ${o.nextActionDate ?? 'no date'})` : 'none — no open linked task'}`,
    `• ${attention}`,
    `• Open tasks (${open.length}):`,
    ...(open.length ? open : ['  – None']),
  ].join('\n')
}

/** Core answer engine used by both client (static demo) and server. */
export function answerFromKnowledge(question: string, knowledge: AiKnowledge): AiAnswer {
  const q = question.trim()
  const tokens = tokenize(q)
  const sources: AiAnswer['sources'] = []
  const opps = knowledge.opportunities ?? []

  if (!q) {
    return { mode: 'retrieval', sources, answer: 'Type a question, for example “Summarize Project A” or “Which deals need attention?”.' }
  }

  // Named projects are answered from that exact record only, never from a fuzzy guess.
  const mentions = findMentionedProjects(q, opps)
  if (mentions.length) {
    const found = mentions.filter((m) => m.match)
    const unknown = mentions.filter((m) => !m.match).map((m) => m.text)
    for (const m of found) sources.push({ type: 'opportunity', id: m.match!.id, label: m.match!.projectName })
    const parts = found.map((m) => summarizeProject(m.match!, knowledge))
    if (unknown.length) {
      parts.push(`I could not find ${unknown.join(', ')} in the CRM. Check the project name or deal ID on the Opportunities page.`)
    }
    return { mode: 'retrieval', sources, answer: parts.join('\n\n') }
  }

  const scoredOpps = opps
    .map((o) => ({
      o,
      score:
        scoreText(
          `${o.projectName} ${o.entityName} ${o.status} ${o.stage} ${o.dealLead} ${o.specialty} ${o.geography} ${o.nextAction} ${(o.outstandingItems ?? []).join(' ')} ${o.diligenceNotes ?? ''}`,
          tokens,
        ) +
        (o.needsAttention && /attention|overdue|risk|urgent/.test(q.toLowerCase()) ? 5 : 0) +
        (o.status === 'Active' && /active/.test(q.toLowerCase()) ? 2 : 0),
    }))
    .sort((a, b) => b.score - a.score)

  const lower = q.toLowerCase()

  // Intent: needs attention
  if (/need[s]? attention|at risk|overdue|urgent/.test(lower)) {
    const list = opps.filter((o) => o.needsAttention)
    list.forEach((o) =>
      sources.push({ type: 'opportunity', id: o.id, label: o.projectName }),
    )
    if (list.length === 0) {
      return {
        mode: 'retrieval',
        sources,
        answer:
          'I scanned the full pipeline — no deals are currently flagged Needs Attention. Priority A deals still worth a glance: ' +
          opps
            .filter((o) => o.priority === 'A')
            .slice(0, 3)
            .map((o) => o.projectName)
            .join(', ') +
          '.',
      }
    }
    const lines = list
      .map(
        (o) =>
          `• **${o.projectName}** (${o.entityName}) — ${o.stage} / ${o.status}. Reasons: ${(o.attentionReasons ?? []).join('; ') || 'flagged'}. Next: ${o.nextAction ?? 'unassigned'}.`,
      )
      .join('\n')
    return {
      mode: 'retrieval',
      sources,
      answer: `I found **${list.length}** deal(s) that need attention across the CRM:\n\n${lines}\n\nRecommended focus: clear overdue next actions and call counsel/accountant items on the Outstanding list.`,
    }
  }

  // Intent: no next action
  if (/no next action|missing next action|without next/.test(lower)) {
    const list = opps.filter(
      (o) =>
        (o.status === 'Active' || o.status === 'Pending') &&
        (!o.nextAction || !String(o.nextAction).trim()),
    )
    list.forEach((o) =>
      sources.push({ type: 'opportunity', id: o.id, label: o.projectName }),
    )
    return {
      mode: 'retrieval',
      sources,
      answer:
        list.length === 0
          ? 'All Active/Pending deals have a next action assigned. Pipeline hygiene looks good.'
          : `Active/Pending deals with **no next action**:\n\n${list
              .map((o) => `• **${o.projectName}** — ${o.stage}, lead ${o.dealLead}`)
              .join('\n')}`,
    }
  }

  // Intent: what changed / this week
  if (/changed|this week|recent|update/.test(lower)) {
    const recent = [...opps]
      .sort(
        (a, b) =>
          new Date(b.lastActivityDate).getTime() - new Date(a.lastActivityDate).getTime(),
      )
      .slice(0, 5)
    recent.forEach((o) =>
      sources.push({ type: 'opportunity', id: o.id, label: o.projectName }),
    )
    return {
      mode: 'retrieval',
      sources,
      answer:
        `Latest pipeline movement (by last activity):\n\n` +
        recent
          .map(
            (o) =>
              `• **${o.projectName}** — ${o.status} @ ${o.stage}. Activity ${new Date(o.lastActivityDate).toLocaleDateString()}. Next: ${o.nextAction ?? '—'}.`,
          )
          .join('\n'),
    }
  }

  // Intent: summarize a named project
  const named = scoredOpps.find((s) => s.score >= 2)
  if (/summar|tell me about|status of|where is|project /.test(lower) && named && named.score > 0) {
    const o = named.o
    sources.push({ type: 'opportunity', id: o.id, label: o.projectName })
    const outstanding = (o.outstandingItems ?? []).length
      ? (o.outstandingItems ?? []).map((i) => `  – ${i}`).join('\n')
      : '  – None logged'
    return {
      mode: 'retrieval',
      sources,
      answer: `**${o.projectName}** (${o.entityName})\n\n• Status: **${o.status}** · Stage: **${o.stage}** · Priority ${o.priority}\n• Lead: ${o.dealLead}\n• Specialty / Geo: ${o.specialty} · ${o.geography}\n• Economics: NWP ${fmtMoney(o.nwp)} · Net Rev ${fmtMoney(o.netRevenue)} · PF EBITDA ${fmtMoney(o.pfEbitda)}\n• Source: ${o.sourceType} — ${o.sourceName}\n• Next action: ${o.nextAction ?? 'unassigned'} (${o.nextActionDate ?? 'n/a'})\n• Outstanding:\n${outstanding}\n• Diligence notes: ${o.diligenceNotes || '—'}\n\nI pulled this from the live opportunity record across the CRM.`,
    }
  }

  // Intent: counts / pipeline overview
  if (/how many|count|pipeline|overview|active deals/.test(lower)) {
    const active = opps.filter((o) => o.status === 'Active')
    const pending = opps.filter((o) => o.status === 'Pending')
    const byStage = new Map<string, number>()
    for (const o of [...active, ...pending]) {
      byStage.set(o.stage, (byStage.get(o.stage) ?? 0) + 1)
    }
    const stageLines = [...byStage.entries()]
      .map(([s, c]) => `• ${s}: ${c}`)
      .join('\n')
    const nwp = active.reduce((s, o) => s + o.nwp, 0)
    return {
      mode: 'retrieval',
      sources: active.slice(0, 5).map((o) => ({
        type: 'opportunity',
        id: o.id,
        label: o.projectName,
      })),
      answer: `Pipeline snapshot from the full CRM book:\n\n• **Active**: ${active.length} deals · combined NWP ${fmtMoney(nwp)}\n• **Pending**: ${pending.length}\n• Needs attention: ${opps.filter((o) => o.needsAttention).length}\n\nActive+Pending by stage:\n${stageLines || '• (none)'}`,
    }
  }

  // Tasks / contacts / documents keyword hits
  const extraBits: string[] = []
  for (const [type, list] of [
    ['task', knowledge.tasks],
    ['contact', knowledge.contacts],
    ['document', knowledge.documents],
    ['source', knowledge.sources],
    ['carrier', knowledge.carriers],
    ['portfolio', knowledge.portfolio],
  ] as const) {
    const arr = list ?? []
    const hits = arr
      .map((row) => ({
        row,
        score: scoreText(JSON.stringify(row), tokens),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
    for (const h of hits) {
      const id = String(h.row.id ?? '')
      const label = String(
        h.row.action ?? h.row.name ?? h.row.title ?? h.row.projectName ?? id,
      )
      sources.push({ type, id, label })
      extraBits.push(`• [${type}] ${label}`)
    }
  }

  if (named && named.score > 0) {
    const o = named.o
    sources.unshift({ type: 'opportunity', id: o.id, label: o.projectName })
    return {
      mode: 'retrieval',
      sources: sources.slice(0, 8),
      answer: `Best match in the CRM for “${q}” is **${o.projectName}** (${o.entityName}) — ${o.status} at stage **${o.stage}**, lead ${o.dealLead}, NWP ${fmtMoney(o.nwp)}. Next action: ${o.nextAction ?? 'unassigned'}.${
        extraBits.length ? `\n\nAlso related across modules:\n${extraBits.join('\n')}` : ''
      }`,
    }
  }

  // Generic helpful fallback with book stats
  const active = opps.filter((o) => o.status === 'Active').length
  return {
    mode: 'retrieval',
    sources,
    answer: `I searched opportunities, tasks, relationships, documents, sources, carriers, and portfolio records for “${q}”.\n\nNo single strong match stood out. Current book: **${opps.length}** opportunities (${active} active). Try asking about a project code name (e.g. Project A), “which deals need attention?”, or “pipeline overview”.${
      extraBits.length ? `\n\nNearby hits:\n${extraBits.join('\n')}` : ''
    }`,
  }
}
