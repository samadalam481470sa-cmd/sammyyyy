import { describe, expect, it } from 'vitest'
import { renderMailHtml, sanitizeMailHtml } from './mailHtml'

describe('mail HTML', () => {
  it('strips scripts and event handlers before the reading pane', () => {
    const html = sanitizeMailHtml(
      '<p onclick="alert(1)">Hello</p><script>alert(1)</script><a href="javascript:alert(1)">x</a><img src="x" onerror="alert(1)">',
    )
    expect(html).toContain('Hello')
    expect(html.toLowerCase()).not.toContain('<script')
    expect(html.toLowerCase()).not.toContain('onclick')
    expect(html.toLowerCase()).not.toContain('onerror')
    expect(html.toLowerCase()).not.toContain('javascript:')
  })

  it('escapes plain text that looks like markup', () => {
    const html = renderMailHtml({ body: '<script>alert(1)</script>' })
    expect(html).toContain('&lt;script&gt;')
    expect(html.toLowerCase()).not.toContain('<script')
  })
})
