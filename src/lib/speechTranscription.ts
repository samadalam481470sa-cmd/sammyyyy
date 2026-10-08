/**
 * Browser live transcription via the Web Speech API (Chrome / Edge).
 * Works on the HTTPS GitHub Pages demo without server credentials.
 */

export type SpeechListener = (payload: {
  text: string
  isFinal: boolean
  speaker: string
}) => void

type SpeechRec = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null
  onerror: ((ev: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionEventLike = {
  resultIndex: number
  results: ArrayLike<{
    isFinal: boolean
    0: { transcript: string }
  }>
}

function getSpeechRecognitionCtor(): (new () => SpeechRec) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec
    webkitSpeechRecognition?: new () => SpeechRec
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function speechSupported(): boolean {
  return Boolean(getSpeechRecognitionCtor())
}

export class LiveTranscriber {
  private rec: SpeechRec | null = null
  private running = false
  private speaker = 'You'
  private onLine: SpeechListener
  private onStatus: (status: string) => void

  constructor(opts: {
    onLine: SpeechListener
    onStatus?: (status: string) => void
    speaker?: string
  }) {
    this.onLine = opts.onLine
    this.onStatus = opts.onStatus ?? (() => undefined)
    this.speaker = opts.speaker ?? 'You'
  }

  setSpeaker(name: string) {
    this.speaker = name || 'You'
  }

  start(lang = 'en-US') {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      this.onStatus('Speech recognition not supported in this browser — use Chrome or Edge.')
      return false
    }
    this.stop()
    const rec = new Ctor()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = lang
    rec.onresult = (ev) => {
      let interim = ''
      let finalText = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const piece = ev.results[i][0].transcript
        if (ev.results[i].isFinal) finalText += piece
        else interim += piece
      }
      if (finalText.trim()) {
        this.onLine({ text: finalText.trim(), isFinal: true, speaker: this.speaker })
      } else if (interim.trim()) {
        this.onLine({ text: interim.trim(), isFinal: false, speaker: this.speaker })
      }
    }
    rec.onerror = (ev) => {
      if (ev.error === 'no-speech' || ev.error === 'aborted') return
      this.onStatus(`Transcription: ${ev.error}`)
    }
    rec.onend = () => {
      // Auto-restart while session is marked running (Teams-style continuous captioning)
      if (this.running) {
        try {
          rec.start()
        } catch {
          this.running = false
          this.onStatus('Transcription paused')
        }
      }
    }
    try {
      rec.start()
      this.rec = rec
      this.running = true
      this.onStatus('Live transcription on')
      return true
    } catch (err) {
      this.onStatus(err instanceof Error ? err.message : 'Could not start transcription')
      return false
    }
  }

  stop() {
    this.running = false
    if (this.rec) {
      try {
        this.rec.onend = null
        this.rec.stop()
      } catch {
        try {
          this.rec.abort()
        } catch {
          /* ignore */
        }
      }
      this.rec = null
    }
    this.onStatus('Transcription off')
  }

  get isRunning() {
    return this.running
  }
}

/** Heuristic summary from a full transcript for CRM notes. */
export function summarizeTranscript(full: string): string {
  const text = full.replace(/\s+/g, ' ').trim()
  if (!text) return ''
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean)
  const head = sentences.slice(0, 3).join(' ')
  const keywords = extractKeywords(text)
  const bits = [head || text.slice(0, 280)]
  if (keywords.length) bits.push(`Key topics: ${keywords.slice(0, 8).join(', ')}.`)
  return bits.join(' ')
}

function extractKeywords(text: string): string[] {
  const stop = new Set(
    'a an the and or but if in on at to for of is are was were be been being with as by from this that it we you they i me my our your their about into over after before not no yes ok okay um uh'.split(
      ' ',
    ),
  )
  const counts = new Map<string, number>()
  for (const raw of text.toLowerCase().match(/[a-z][a-z-]{2,}/g) ?? []) {
    if (stop.has(raw)) continue
    counts.set(raw, (counts.get(raw) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w)
}
