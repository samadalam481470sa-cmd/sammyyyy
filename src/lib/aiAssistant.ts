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

/** Core answer engine used by both client (static demo) and server. */
export function answerFromKnowledge(question: string, knowledge: AiKnowledge): AiAnswer {
  const q = question.trim()
  const tokens = tokenize(q)
  const sources: AiAnswer['sources'] = []
  const opps = knowledge.opportunities ?? []

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
