import { describe, expect, it } from 'vitest'
import { deflateRawSync } from 'node:zlib'
import { docxToText, extractTranscriptText, transcriptFormat, vttToText } from './transcript'

function zip(entries: { name: string; data: Uint8Array; deflate?: boolean }[]): ArrayBuffer {
  const enc = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const e of entries) {
    const name = enc.encode(e.name)
    const body = e.deflate ? new Uint8Array(deflateRawSync(e.data)) : e.data
    const local = new Uint8Array(30 + name.length + body.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(8, e.deflate ? 8 : 0, true)
    lv.setUint32(18, body.length, true)
    lv.setUint32(22, e.data.length, true)
    lv.setUint16(26, name.length, true)
    local.set(name, 30)
    local.set(body, 30 + name.length)
    const central = new Uint8Array(46 + name.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(10, e.deflate ? 8 : 0, true)
    cv.setUint32(20, body.length, true)
    cv.setUint32(24, e.data.length, true)
    cv.setUint16(28, name.length, true)
    cv.setUint32(42, offset, true)
    central.set(name, 46)
    locals.push(local)
    centrals.push(central)
    offset += local.length
  }
  const centralSize = centrals.reduce((s, c) => s + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)
  const all = new Uint8Array(offset + centralSize + 22)
  let p = 0
  for (const part of [...locals, ...centrals, end]) {
    all.set(part, p)
    p += part.length
  }
  return all.buffer
}

const XML = `<w:document><w:body><w:p><w:r><w:t>Mary: Let&apos;s confirm the LOI.</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">Dennis: </w:t></w:r><w:r><w:t>Agreed &amp; I will send it Friday.</w:t></w:r></w:p></w:body></w:document>`

describe('transcript extraction', () => {
  it('reads Word files stored or deflated', async () => {
    for (const deflate of [false, true]) {
      const buffer = zip([
        { name: '[Content_Types].xml', data: new TextEncoder().encode('<Types/>') },
        { name: 'word/document.xml', data: new TextEncoder().encode(XML), deflate },
      ])
      expect(await docxToText(buffer)).toBe("Mary: Let's confirm the LOI.\nDennis: Agreed & I will send it Friday.")
    }
  })

  it('turns WebVTT cues into speaker lines and merges a speaker’s split cues', () => {
    const vtt = `WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\n<v Mary Sbaschnig>We should move to exclusivity.</v>\n\n2\n00:00:03.000 --> 00:00:05.000\n<v Mary Sbaschnig>Next week works.</v>\n\n3\n00:00:05.000 --> 00:00:07.000\n<v Dennis DiCapua>I will draft it.</v>`
    expect(vttToText(vtt)).toBe('Mary Sbaschnig: We should move to exclusivity. Next week works.\nDennis DiCapua: I will draft it.')
  })

  it('accepts only txt, vtt and docx and rejects empty files', async () => {
    expect(transcriptFormat('call.VTT')).toBe('vtt')
    expect(transcriptFormat('call.pdf')).toBeNull()
    await expect(extractTranscriptText(new File([''], 'empty.txt'))).rejects.toThrow(/No text/)
    await expect(extractTranscriptText(new File(['x'], 'call.mp4'))).rejects.toThrow(/\.txt, \.vtt or \.docx/)
    expect((await extractTranscriptText(new File(['Hello\r\nWorld'], 'a.txt'))).text).toBe('Hello\nWorld')
  })
})
