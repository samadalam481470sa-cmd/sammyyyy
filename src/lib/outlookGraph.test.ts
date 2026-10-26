import { describe, expect, it } from 'vitest'
import { graphSendBody } from './outlookGraph'

describe('Outlook Graph mail', () => {
  it('builds a send payload with only real addresses', () => {
    const body = graphSendBody({ to: 'ada@outlook.com, not-an-email', subject: 'Hello', body: 'Note' })
    expect(body.saveToSentItems).toBe(true)
    expect(body.message).toMatchObject({
      subject: 'Hello',
      toRecipients: [{ emailAddress: { address: 'ada@outlook.com' } }],
    })
  })
})
