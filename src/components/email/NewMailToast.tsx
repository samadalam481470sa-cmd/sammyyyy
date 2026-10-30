import { useEffect, useState } from 'react'
import { Mail, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { NEW_MAIL_EVENT } from '@/lib/outlookSync'
import { senderDisplayName, type MailMessage } from '@/lib/outlookMailbox'

interface NewMail {
  count: number
  latest?: MailMessage
}

/** "New email" pop-up on any page, plus a desktop notification when the window is in the background. */
export function NewMailToast() {
  const [mail, setMail] = useState<NewMail | null>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const onEmailPage = location.pathname.startsWith('/email')

  useEffect(() => {
    const onNew = (event: Event) => {
      const detail = (event as CustomEvent<NewMail>).detail
      if (!detail?.count) return
      const sender = (detail.latest ? senderDisplayName(detail.latest) : '') || 'someone'
      const subject = detail.latest?.subject || '(no subject)'
      if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(detail.count > 1 ? `${detail.count} new emails` : `New email from ${sender}`, { body: subject })
        } catch {
          // notifications blocked in this context
        }
      }
      setMail(detail)
    }
    window.addEventListener(NEW_MAIL_EVENT, onNew)
    return () => window.removeEventListener(NEW_MAIL_EVENT, onNew)
  }, [])

  useEffect(() => {
    if (!mail) return
    const timer = window.setTimeout(() => setMail(null), 8000)
    return () => window.clearTimeout(timer)
  }, [mail])

  if (!mail || onEmailPage) return null
  return (
    <div role="status" data-testid="new-mail-toast" className="fixed right-4 bottom-4 z-[90] flex max-w-sm items-start gap-3 rounded-xl border border-[#c7dcf0] bg-white p-3 shadow-lg">
      <Mail className="mt-0.5 h-5 w-5 shrink-0 text-[#0f6cbd]" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#242424]">
          {mail.count > 1 ? `${mail.count} new emails` : `New email from ${(mail.latest ? senderDisplayName(mail.latest) : '') || 'someone'}`}
        </p>
        <p className="truncate text-xs text-[#616161]">{mail.latest?.subject || '(no subject)'}</p>
        <button
          type="button"
          onClick={() => {
            setMail(null)
            navigate('/email')
          }}
          className="mt-2 h-7 rounded-md bg-[#0f6cbd] px-3 text-xs font-semibold text-white hover:bg-[#115ea3]"
        >
          Open Email
        </button>
      </div>
      <button type="button" aria-label="Dismiss" onClick={() => setMail(null)} className="rounded p-1 text-[#616161] hover:bg-[#f0f0f0]">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
