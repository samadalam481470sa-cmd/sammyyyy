import { formatCompactCurrency, formatDate, formatRelativeTime } from "./format.ts"
import type { CrmSnapshot, Opportunity } from "../types/crm.ts"

export interface AiBlock {
  text: string
  projectId?: string
}

export interface AiReply {
  blocks: AiBlock[]
}

export interface AiContext {
  snapshot: CrmSnapshot
}

export interface NewportAiClient {
  ask(prompt: string, context: AiContext): Promise<AiReply>
}

function findProject(opportunities: Opportunity[], prompt: string): Opportunity | undefined {
  const query = prompt.toLowerCase()
  const matches = opportunities.filter((opportunity) => {
    const project = opportunity.projectName.toLowerCase()
    const entity = opportunity.entityName.toLowerCase()
    return query.includes(project) || query.includes(entity)
  })
  return matches.sort((a, b) => b.projectName.length - a.projectName.length)[0]
}

function summarize(opportunity: Opportunity): AiBlock[] {
  const next = opportunity.nextAction
    ? `Next action: ${opportunity.nextAction}${opportunity.nextActionDate ? ` (${formatDate(opportunity.nextActionDate, true)})` : ""}.`
    : "No next action is assigned."
  const attention = opportunity.attentionReason ? ` Attention: ${opportunity.attentionReason}.` : ""
  return [
    {
      text: `${opportunity.projectName} — ${opportunity.entityName} — is ${opportunity.status} and in ${opportunity.stage}, led by ${opportunity.dealLead ?? "an unassigned owner"}. NWP is ${formatCompactCurrency(opportunity.nwp)}, net revenue is ${formatCompactCurrency(opportunity.netRevenue)}, and pro forma EBITDA is ${formatCompactCurrency(opportunity.pfEbitda)}. ${next}${attention}`,
      projectId: opportunity.id,
    },
  ]
}

export function respondToPrompt(prompt: string, context: AiContext): AiReply {
  const query = prompt.trim().toLowerCase()
  const { opportunities, activities, asOf } = context.snapshot

  if (!query) {
    return { blocks: [{ text: "Ask a question about the acquisition pipeline." }] }
  }

  if (query.includes("no next action")) {
    const missing = opportunities.filter((opportunity) => opportunity.status === "Active" && !opportunity.nextAction)
    if (missing.length === 0) {
      const elsewhere = opportunities.filter((opportunity) => opportunity.needsAttention && !opportunity.nextAction)
      const blocks: AiBlock[] = [
        { text: "None of the active deals are missing a next action." },
      ]
      if (elsewhere.length > 0) {
        blocks.push({ text: "Outside the active book:" })
        for (const opportunity of elsewhere) {
          blocks.push({
            text: `${opportunity.projectName} (${opportunity.status}) has no next action assigned.`,
            projectId: opportunity.id,
          })
        }
      }
      return { blocks }
    }
    return {
      blocks: [
        { text: `${missing.length === 1 ? "One active deal has" : `${missing.length} active deals have`} no next action.` },
        ...missing.map((opportunity) => ({
          text: `${opportunity.projectName} — ${opportunity.entityName}, ${opportunity.stage}.`,
          projectId: opportunity.id,
        })),
      ],
    }
  }

  if (query.includes("attention") || query.includes("overdue") || query.includes("stalled")) {
    const flagged = opportunities.filter((opportunity) => opportunity.needsAttention)
    if (flagged.length === 0) {
      return { blocks: [{ text: "Nothing in the current book needs attention." }] }
    }
    return {
      blocks: [
        {
          text: `${flagged.length} ${flagged.length === 1 ? "opportunity needs" : "opportunities need"} attention.`,
        },
        ...flagged.map((opportunity) => ({
          text: `${opportunity.projectName} — ${opportunity.attentionReason ?? "Needs attention"}.`,
          projectId: opportunity.id,
        })),
      ],
    }
  }

  if (query.includes("changed") || query.includes("this week") || query.includes("recent")) {
    const recent = activities
      .slice()
      .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))
      .slice(0, 5)
    if (recent.length === 0) {
      return { blocks: [{ text: "No activity has been logged in this workspace yet." }] }
    }
    return {
      blocks: [
        { text: "Recent movement across the book:" },
        ...recent.map((activity) => ({
          text: `${activity.message} — ${formatRelativeTime(activity.occurredAt, asOf)}`,
          projectId: activity.projectId,
        })),
      ],
    }
  }

  const named = findProject(opportunities, prompt)
  if (query.includes("summar") || named) {
    if (!named) {
      return { blocks: [{ text: "I couldn't find a project by that name in the current pipeline." }] }
    }
    return { blocks: summarize(named) }
  }

  return {
    blocks: [
      {
        text: "I can answer from the deals in this workspace. Try asking which deals need attention, what changed this week, or for a summary of a project code name.",
      },
    ],
  }
}

export const localNewportAi: NewportAiClient = {
  async ask(prompt, context) {
    return respondToPrompt(prompt, context)
  },
}
