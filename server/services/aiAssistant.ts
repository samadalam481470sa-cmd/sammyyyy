import { db } from '../db/index.ts'
import { rowToOpportunity, type DbOpportunityRow } from '../mappers.ts'
import {
  answerFromKnowledge,
  type AiAnswer,
  type AiKnowledge,
} from '../../src/lib/aiAssistant.ts'
import { geminiConfigured, geminiGenerate } from './gemini.ts'

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

const ASSISTANT_SYSTEM =
  'You are Newport AI, the acquisition CRM assistant for Newport Specialty Partners. Answer only from the provided CRM knowledge. Be concise, executive, and cite project code names.'

async function answerWithGemini(question: string, knowledge: AiKnowledge): Promise<AiAnswer | null> {
  const brief = knowledgeBrief(knowledge).slice(0, 12000)
  try {
    const text = await geminiGenerate({ system: ASSISTANT_SYSTEM, user: `CRM DATA:\n${brief}\n\nQUESTION: ${question}`, temperature: 0.2 })
    return text ? { answer: text, sources: [], mode: 'llm' } : null
  } catch {
    return null
  }
}

async function answerWithLlm(question: string, knowledge: AiKnowledge): Promise<AiAnswer | null> {
  if (geminiConfigured()) return answerWithGemini(question, knowledge)
  const azure = Boolean(process.env.AZURE_OPENAI_ENDPOINT)
  const key = azure ? process.env.AZURE_OPENAI_API_KEY : process.env.OPENAI_API_KEY
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT
  if (!key || (azure && (!deployment || !endpoint))) return null
  if (azure) {
    try {
      const parsed = new URL(endpoint!)
      if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.openai.azure.com') || parsed.username || parsed.password) return null
    } catch { return null }
  }

  const brief = knowledgeBrief(knowledge).slice(0, 12000)
  try {
    const url = azure ? new URL('/openai/v1/chat/completions', endpoint).toString() : 'https://api.openai.com/v1/chat/completions'
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...(azure ? { 'api-key': key } : { Authorization: `Bearer ${key}` }),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: azure ? deployment : (process.env.OPENAI_MODEL || 'gpt-4o-mini'),
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
