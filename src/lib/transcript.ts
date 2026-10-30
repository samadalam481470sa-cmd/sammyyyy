/**
 * Transcript text extraction for TXT, WebVTT and Word (.docx) files.
 * DOCX is read with the browser's built-in DecompressionStream; no file leaves the device here.
 */
export type TranscriptFormat = 'txt' | 'vtt' | 'docx'

export const TRANSCRIPT_ACCEPT = '.txt,.vtt,.docx,text/plain,text/vtt,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
export const TRANSCRIPT_MAX_BYTES = 10 * 1024 * 1024

export function transcriptFormat(fileName: string): TranscriptFormat | null {
  const ext = fileName.toLowerCase().split('.').pop() ?? ''
  if (ext === 'txt') return 'txt'
  if (ext === 'vtt') return 'vtt'
  if (ext === 'docx') return 'docx'
  return null
}

/** WebVTT -> plain lines "Speaker: words", without cue numbers, timings or tags. */
export function vttToText(raw: string): string {
  const out: string[] = []
  const blocks = raw.replace(/\r\n?/g, '\n').split(/\n{2,}/)
  for (const block of blocks) {
    const lines = block.split('\n').filter(Boolean)
    if (!lines.length) continue
    if (/^WEBVTT/.test(lines[0]) || /^(NOTE|STYLE|REGION)\b/.test(lines[0])) continue
    const timing = lines.findIndex((l) => l.includes('-->'))
    const textLines = timing >= 0 ? lines.slice(timing + 1) : lines
    for (const line of textLines) {
      const voice = /^<v(?:\.[^ >]*)?\s+([^>]+)>(.*)$/.exec(line)
      const clean = (voice ? `${voice[1].trim()}: ${voice[2]}` : line).replace(/<[^>]+>/g, '').trim()
      if (clean) out.push(clean)
    }
  }
  // Teams often splits one sentence into several cues by the same speaker; join them.
  const merged: string[] = []
  for (const line of out) {
    const m = /^([^:]{1,60}):\s(.*)$/.exec(line)
    const prev = merged[merged.length - 1]
    const pm = prev ? /^([^:]{1,60}):\s(.*)$/.exec(prev) : null
    if (m && pm && m[1] === pm[1]) merged[merged.length - 1] = `${pm[1]}: ${pm[2]} ${m[2]}`
    else merged.push(line)
  }
  return merged.join('\n')
}

function decodeXmlText(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
}

/** word/document.xml -> paragraphs of text. */
export function documentXmlToText(xml: string): string {
  const paragraphs = xml.split(/<\/w:p>/)
  const out: string[] = []
  for (const p of paragraphs) {
    const parts: string[] = []
    const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>/g
    let m: RegExpExecArray | null
    while ((m = re.exec(p))) {
      if (m[0] === '<w:tab/>') parts.push('\t')
      else if (m[0] === '<w:br/>') parts.push('\n')
      else parts.push(decodeXmlText(m[1]))
    }
    const line = parts.join('').trim()
    if (line) out.push(line)
  }
  return out.join('\n')
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Reads one file out of a ZIP archive (stored or deflate). */
export async function readZipEntry(buffer: ArrayBuffer, name: string): Promise<Uint8Array | null> {
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) return null
  const count = view.getUint16(eocd + 10, true)
  let offset = view.getUint32(eocd + 16, true)
  const decoder = new TextDecoder()
  for (let n = 0; n < count && offset + 46 <= bytes.length; n += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) return null
    const method = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const nameLen = view.getUint16(offset + 28, true)
    const extraLen = view.getUint16(offset + 30, true)
    const commentLen = view.getUint16(offset + 32, true)
    const localOffset = view.getUint32(offset + 42, true)
    const entryName = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLen))
    if (entryName === name) {
      const localNameLen = view.getUint16(localOffset + 26, true)
      const localExtraLen = view.getUint16(localOffset + 28, true)
      const start = localOffset + 30 + localNameLen + localExtraLen
      const data = bytes.subarray(start, start + compressedSize)
      if (method === 0) return data
      if (method === 8) return inflateRaw(data)
      return null
    }
    offset += 46 + nameLen + extraLen + commentLen
  }
  return null
}

export async function docxToText(buffer: ArrayBuffer): Promise<string> {
  const xml = await readZipEntry(buffer, 'word/document.xml')
  if (!xml) throw new Error('This Word file could not be read. Save it again as .docx, or upload a .txt or .vtt transcript.')
  return documentXmlToText(new TextDecoder().decode(xml))
}

export async function extractTranscriptText(file: File): Promise<{ format: TranscriptFormat; text: string }> {
  const format = transcriptFormat(file.name)
  if (!format) throw new Error('Upload a .txt, .vtt or .docx transcript.')
  if (file.size > TRANSCRIPT_MAX_BYTES) throw new Error('This transcript is larger than 10 MB.')
  let text: string
  if (format === 'docx') text = await docxToText(await file.arrayBuffer())
  else if (format === 'vtt') text = vttToText(await file.text())
  else text = (await file.text()).replace(/\r\n?/g, '\n').trim()
  if (!text.trim()) throw new Error('No text was found in this transcript file.')
  return { format, text }
}
