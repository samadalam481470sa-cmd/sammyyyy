import { describe, expect, it } from 'vitest'
import {
  GRAPH_WELL_KNOWN_FOLDERS,
  OUTLOOK_SCOPES,
  folderMessagesPath,
  graphForwardBody,
  graphReplyAllBody,
  graphReplyBody,
  graphSendBody,
  outlookInteractiveRequest,
  parseGraphDelta,
} from './outlookGraph'

describe('Outlook Graph mail', () => {
  it('builds a send payload with to, cc, and bcc and no from override', () => {
    const body = graphSendBody({
      to: 'ada@outlook.com; not-an-email, sam@newport.test',
      cc: 'Friend <cc@gmail.com>',
      bcc: 'hidden@company.test',
      subject: 'Hello',
      body: 'Note',
    })
    expect(body.saveToSentItems).toBe(true)
    expect(body).not.toHaveProperty('from')
    const message = body.message as {
      subject: string
      from?: unknown
      toRecipients: unknown
      ccRecipients: unknown
      bccRecipients: unknown
    }
    expect(message.from).toBeUndefined()
    expect(message.subject).toBe('Hello')
    expect(message.toRecipients).toEqual([
      { emailAddress: { address: 'ada@outlook.com' } },
      { emailAddress: { address: 'sam@newport.test' } },
    ])
    expect(message.ccRecipients).toEqual([{ emailAddress: { address: 'cc@gmail.com' } }])
    expect(message.bccRecipients).toEqual([{ emailAddress: { address: 'hidden@company.test' } }])
  })

  it('keeps an empty subject and omits blank cc', () => {
    const body = graphSendBody({ to: 'ada@gmail.com', subject: '', body: 'Note' })
    const message = body.message as { subject: string; ccRecipients?: unknown; from?: unknown }
    expect(message.subject).toBe('(no subject)')
    expect(message.ccRecipients).toBeUndefined()
    expect(message.from).toBeUndefined()
  })

  it('builds reply, reply-all, and forward payloads without a from override', () => {
    expect(graphReplyBody('Thanks')).toEqual({ comment: 'Thanks' })
    expect(graphReplyAllBody('Thanks all')).toEqual({ comment: 'Thanks all' })
    const forward = graphForwardBody({ to: 'ada@gmail.com', cc: 'sam@outlook.com', comment: 'FYI' })
    expect(forward).not.toHaveProperty('from')
    expect(forward.toRecipients).toEqual([{ emailAddress: { address: 'ada@gmail.com' } }])
    expect(forward.ccRecipients).toEqual([{ emailAddress: { address: 'sam@outlook.com' } }])
    expect(forward.comment).toBe('FYI')
  })

  it('uses Graph well-known folder names and does not ask for full bodies in the list', () => {
    expect(GRAPH_WELL_KNOWN_FOLDERS).toEqual({
      inbox: 'inbox',
      sent: 'sentitems',
      drafts: 'drafts',
      junk: 'junkemail',
      deleted: 'deleteditems',
      archive: 'archive',
    })
    for (const folder of Object.keys(GRAPH_WELL_KNOWN_FOLDERS) as Array<keyof typeof GRAPH_WELL_KNOWN_FOLDERS>) {
      const path = folderMessagesPath(folder, 'list')
      const select = new URL(`https://graph.microsoft.com/v1.0${path}`).searchParams.get('$select')?.split(',')
      expect(path).toContain(`/mailFolders/${GRAPH_WELL_KNOWN_FOLDERS[folder]}/`)
      expect(select).not.toContain('body')
      expect(select).toEqual(expect.arrayContaining(['bodyPreview', 'hasAttachments', 'id']))
    }
  })

  it('merges a delta page by id and records removals', () => {
    const parsed = parseGraphDelta(
      {
        value: [
          {
            id: 'a',
            subject: 'Hello',
            bodyPreview: 'preview',
            isRead: false,
            hasAttachments: true,
            from: { emailAddress: { address: 'ada@gmail.com' } },
          },
          { id: 'gone', '@removed': { reason: 'deleted' } },
        ],
        '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/delta?token=1',
      },
      'inbox',
    )
    expect(parsed.messages.map((message) => message.id)).toEqual(['a'])
    expect(parsed.messages[0]?.body).toBe('')
    expect(parsed.messages[0]?.hasAttachments).toBe(true)
    expect(parsed.messages[0]?.from).toBe('ada@gmail.com')
    expect(parsed.removedIds).toEqual(['gone'])
    expect(parsed.deltaLink).toContain('token=1')
  })

  it('asks Graph for read and send on the signed-in mailbox without a prompt override', () => {
    expect(OUTLOOK_SCOPES).toEqual(expect.arrayContaining(['Mail.Read', 'Mail.ReadWrite', 'Mail.Send']))
    expect(outlookInteractiveRequest()).not.toHaveProperty('prompt')
    expect(outlookInteractiveRequest().scopes).toEqual(OUTLOOK_SCOPES)
  })
})
