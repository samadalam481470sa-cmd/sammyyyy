import type { MailMessage } from '@/lib/outlookMailbox'

const BLOCK = 'script|iframe|object|embed|link|meta|base|form|svg|math|style|frame|frameset'

function stripDangerousBlocks(html: string): string {
  let next = html.replace(/<!--[\s\S]*?-->/g, '')
  const paired = new RegExp(`<\\s*(${BLOCK})\\b[^>]*>[\\s\\S]*?<\\s*/\\s*\\1\\s*>`, 'gi')
  const single = new RegExp(`<\\s*(${BLOCK})\\b[^>]*\\/?>`, 'gi')
  for (let i = 0; i < 4; i += 1) {
    const stripped = next.replace(paired, '').replace(single, '')
    if (stripped === next) break
    next = stripped
  }
  return next
}

function stripHandlers(html: string): string {
  return html
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href|src|xlink:href)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, '')
    .replace(/\s(href|src|xlink:href)\s*=\s*javascript:[^\s>]*/gi, '')
    .replace(/\s(href|src)\s*=\s*(['"])\s*data:(?!image\/)[^'"]*\2/gi, '')
}

/** Remove scripts, event handlers, and javascript URLs before HTML is inserted into the reading pane. */
export function sanitizeMailHtml(html: string): string {
  return stripHandlers(stripDangerousBlocks(html))
}

function plainToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  return `<p>${escaped.replace(/\n/g, '<br>')}</p>`
}

export function renderMailHtml(message: Pick<MailMessage, 'body' | 'bodyHtml'>): string {
  const rich = message.bodyHtml?.trim()
  const source = rich ? message.bodyHtml ?? '' : plainToHtml(message.body || '')
  return sanitizeMailHtml(source)
}
