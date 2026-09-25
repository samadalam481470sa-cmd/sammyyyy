/**
 * Newport AI service seam.
 *
 * The dashboard component talks only to `askNewportAI`, so connecting a real
 * model later is a change to this file: send the question plus the current
 * pipeline context to the backend and stream the answer back.
 */

export interface AssistantRequest {
  question: string;
  /** Lightweight, non-sensitive context about what the user is looking at. */
  context?: {
    statusFilter: string;
    visibleOpportunities: number;
    needsAttention: number;
  };
}

export interface AssistantReply {
  question: string;
  answer: string;
  /** False until a model is wired up — the UI labels replies accordingly. */
  connected: boolean;
}

export async function askNewportAI(request: AssistantRequest): Promise<AssistantReply> {
  const scope = request.context
    ? ` Once connected it will answer against the ${request.context.visibleOpportunities} opportunit${
        request.context.visibleOpportunities === 1 ? 'y' : 'ies'
      } currently in view.`
    : '';

  return {
    question: request.question,
    answer: `Newport AI is not connected in this sprint.${scope}`,
    connected: false,
  };
}

export const SUGGESTED_PROMPTS = [
  'Which deals need attention?',
  'What changed this week?',
  'Show active deals with no next action',
  'Summarize Project Guardian',
] as const;
