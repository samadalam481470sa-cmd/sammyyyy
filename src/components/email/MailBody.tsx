import { useMemo, useRef, useState } from 'react'
import { ImageOff, Loader2 } from 'lucide-react'
import { mailDocument } from '@/lib/mailHtml'
import type { MailMessage } from '@/lib/outlookMailbox'

interface MailBodyProps {
  message: MailMessage
  /** Why the full message could not be loaded, if it failed. */
  error?: string | null
  onRetry?: () => void
}

/**
 * Email body in a sandboxed frame (guide p82): no scripts, links open in a new tab, and remote
 * images stay blocked until the reader chooses to show them for this message.
 */
export function MailBody({ message, error, onRetry }: MailBodyProps) {
  const [showImages, setShowImages] = useState(false)
  const [height, setHeight] = useState(240)
  const frame = useRef<HTMLIFrameElement>(null)

  const { html, blockedImages } = useMemo(
    () => mailDocument({ body: message.body, bodyHtml: message.bodyHtml }, { showImages }),
    [message.body, message.bodyHtml, showImages],
  )

  const measure = () => {
    const doc = frame.current?.contentDocument
    if (!doc?.documentElement) return
    setHeight(Math.min(20000, Math.max(120, doc.documentElement.scrollHeight + 8)))
  }

  const loading = !message.bodyLoaded && !message.demo && !message.pending && !error && !message.body.trim()

  return (
    <div className="mt-5" data-testid="email-body">
      {error && (
        <div role="alert" className="mb-3 rounded-md border border-[#f1bbbc] bg-[#fdf3f4] px-3 py-2 text-sm text-[#a4262c]">
          The full message could not be loaded: {error}{' '}
          {onRetry && (
            <button type="button" onClick={onRetry} className="font-semibold underline">
              Try again
            </button>
          )}
          {message.preview && <p className="mt-1 text-[#424242]">Preview: {message.preview}</p>}
        </div>
      )}
      {loading && (
        <p className="mb-3 inline-flex items-center gap-2 text-sm text-[#616161]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading the full message…
        </p>
      )}
      {blockedImages > 0 && !showImages && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md bg-[#f5f5f5] px-3 py-2 text-xs text-[#424242]">
          <ImageOff className="h-4 w-4" />
          Remote images are blocked to protect your privacy.
          <button type="button" data-testid="email-show-images" onClick={() => setShowImages(true)} className="font-semibold text-[#0f6cbd] hover:underline">
            Show images
          </button>
        </div>
      )}
      <iframe
        ref={frame}
        title={`Email: ${message.subject || 'message'}`}
        data-testid="email-body-frame"
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        srcDoc={html}
        onLoad={() => {
          measure()
          window.setTimeout(measure, 400)
        }}
        className="w-full border-0 bg-white"
        style={{ height }}
      />
    </div>
  )
}
