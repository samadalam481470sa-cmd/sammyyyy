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

/**
 * A complete, isolated document for a sandboxed iframe (guide p82). Scripts cannot run, links
 * open in a new tab, and remote images stay blocked until the user chooses to show them.
 */
export function mailDocument(
  message: Pick<MailMessage, 'body' | 'bodyHtml'>,
  options: { showImages: boolean },
): { html: string; blockedImages: number } {
  let body = renderMailHtml(message)
  let blockedImages = 0
  if (!options.showImages) {
    body = body.replace(/(<img\b[^>]*?)\s(src|srcset)\s*=\s*(["'])\s*(https?:)?\/\/[^"']*\3/gi, (_m, start: string) => {
      blockedImages += 1
      return `${start} data-blocked="1" alt="[image blocked]"`
    })
    body = body.replace(/url\(\s*(["']?)\s*(https?:)?\/\/[^)]*\)/gi, () => {
      blockedImages += 1
      return 'none'
    })
  }
  const imgSrc = options.showImages ? 'data: https: http:' : 'data:'
  const html = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${imgSrc}; style-src 'unsafe-inline'; font-src data:">
<base target="_blank"><style>
body{margin:0;font:14px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#242424;word-wrap:break-word;overflow-wrap:anywhere}
a{color:#0f6cbd}img{max-width:100%;height:auto}img[data-blocked]{display:inline-block;min-width:16px;min-height:16px;background:#f0f0f0}
blockquote{border-left:2px solid #e0e0e0;margin:0 0 0 4px;padding-left:12px;color:#424242}table{max-width:100%}p{margin:0 0 12px}pre{white-space:pre-wrap}
</style></head><body>${body}</body></html>`
  return { html, blockedImages }
}
