import { db } from '../db/index.ts'
import { rowToOpportunity, type DbOpportunityRow } from '../mappers.ts'
import {
  answerFromKnowledge,
  type AiAnswer,
  type AiKnowledge,
} from '../../src/lib/aiAssistant.ts'

function loadKnowledge(): AiKnowledge {
  const opps = (
    db.prepare(`SELECT * FROM opportunities ORDER BY project_number ASC`).all() as DbOpportunityRow[]
  ).map(rowToOpportunity)

  const mapRows = (table: string) =>
    db.prepare(`SELECT * FROM ${table}`).all() as Array<Record<string, unknown>>

  return {
    opportunities: opps,
    tasks: mapRows('tasks'),
    contacts: mapRows('contacts'),
    documents: mapRows('documents'),
    sources: mapRows('sources'),
    carriers: mapRows('carriers'),
    portfolio: mapRows('portfolio_companies'),
  }
}

function knowledgeBrief(k: AiKnowledge): string {
  const lines: string[] = ['Newport Specialty Partners CRM knowledge:']
  for (const o of k.opportunities) {
    lines.push(
      `- Opportunity ${o.projectName} | entity=${o.entityName} | status=${o.status} | stage=${o.stage} | lead=${o.dealLead} | nwp=${o.nwp} | next=${o.nextAction} | attention=${o.needsAttention} | outstanding=${(o.outstandingItems ?? []).join('; ')}`,
    )
  }
  for (const t of k.tasks ?? []) {
    lines.push(`- Task ${t.action} | status=${t.status} | owner=${t.owner} | project=${t.project_name}`)
  }
  for (const c of k.contacts ?? []) {
    lines.push(`- Contact ${c.name} | ${c.title} @ ${c.company} | ${c.category} | project=${c.project_name}`)
  }
  for (const d of k.documents ?? []) {
    lines.push(`- Document ${d.name} | type=${d.doc_type} | status=${d.status} | project=${d.project_name}`)
  }
  return lines.join('\n')
}

async function answerWithLlm(question: string, knowledge: AiKnowledge): Promise<AiAnswer | null> {
  const key = process.env.OPENAI_API_KEY
  if (!key) return null

  const brief = knowledgeBrief(knowledge).slice(0, 12000)
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'You are Newport AI, the acquisition CRM assistant for Newport Specialty Partners. Answer only from the provided CRM knowledge. Be concise, executive, and cite project code names.',
          },
          {
            role: 'user',
            content: `CRM DATA:\n${brief}\n\nQUESTION: ${question}`,
          },
        ],
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const text = data.choices?.[0]?.message?.content?.trim()
    if (!text) return null
    return { answer: text, sources: [], mode: 'llm' }
  } catch {
    return null
  }
}

export async function askNewportAi(question: string): Promise<AiAnswer> {
  const knowledge = loadKnowledge()
  const llm = await answerWithLlm(question, knowledge)
  if (llm) return llm
  return answerFromKnowledge(question, knowledge)
}
