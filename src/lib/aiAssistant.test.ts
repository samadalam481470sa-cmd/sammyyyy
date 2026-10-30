import { describe, expect, it } from 'vitest'
import { answerFromKnowledge, findMentionedProjects } from './aiAssistant'
import { bundledSeedSnapshot } from './portableDatabase'
import { applyNextActionSummary } from './nextAction'
import { withLiveAttention } from './attention'

const NOW = new Date(2026, 9, 30, 9, 0, 0)
const seeds = bundledSeedSnapshot()
const opportunities = withLiveAttention(seeds.opportunities.map((o) => applyNextActionSummary(o, seeds.tasks, NOW)), seeds.tasks, NOW)
const knowledge = { opportunities, tasks: seeds.tasks as unknown as Array<Record<string, unknown>> }

describe('Newport AI', () => {
  it('answers successive questions about the exact project asked', () => {
    const a = answerFromKnowledge('Summarize Project A', knowledge)
    const b = answerFromKnowledge('Summarize Project B', knowledge)
    const aq = answerFromKnowledge('what is going on with project aq?', knowledge)
    expect(a.answer).toMatch(/^\*\*Project A\*\*/)
    expect(b.answer).toMatch(/^\*\*Project B\*\*/)
    expect(aq.answer).toMatch(/^\*\*Project AQ\*\*/)
    expect(b.sources.map((s) => s.label)).toEqual(['Project B'])
    expect(b.answer).not.toMatch(/Project BA|Project A\b/)
  })

  it('never answers an unknown project with another project', () => {
    const answer = answerFromKnowledge('Summarize Project ZZZ', knowledge)
    expect(answer.answer).toMatch(/could not find Project ZZZ/i)
    expect(answer.sources).toHaveLength(0)
  })

  it('matches deal IDs and keeps Project B apart from Project BA', () => {
    const mentions = findMentionedProjects('Compare DEAL-043 with Project B', opportunities)
    expect(mentions.map((m) => m.match?.projectName)).toEqual(['Project B', 'Project AQ'])
    expect(findMentionedProjects('Project BA status', opportunities).map((m) => m.match?.projectName)).toEqual(['Project BA'])
  })

  it('gives a helpful answer for empty input', () => {
    expect(answerFromKnowledge('   ', knowledge).answer).toMatch(/Summarize Project A/)
  })
})
