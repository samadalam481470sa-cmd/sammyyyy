import { describe, expect, it } from 'vitest'
import { OUTLOOK_SCOPES, graphSendBody } from './outlookGraph'

describe('Outlook Graph mail', () => {
  it('builds a send payload with only real addresses and no from override', () => {
    const body = graphSendBody({ to: 'ada@outlook.com; not-an-email, sam@newport.test', subject: '', body: 'Note' })
    expect(body.saveToSentItems).toBe(true)
    expect(body).not.toHaveProperty('from')
    const message = body.message as { subject: string; from?: unknown; toRecipients: unknown }
    expect(message.from).toBeUndefined()
    expect(message.subject).toBe('(no subject)')
    expect(message.toRecipients).toEqual([
      { emailAddress: { address: 'ada@outlook.com' } },
      { emailAddress: { address: 'sam@newport.test' } },
    ])
  })

  it('asks Graph for read and send on the signed-in mailbox', () => {
    expect(OUTLOOK_SCOPES).toEqual(expect.arrayContaining(['Mail.Read', 'Mail.ReadWrite', 'Mail.Send']))
  })
})
