import { Delete, Phone, PhoneOff } from 'lucide-react'
import { normalizePhoneDisplay } from '@/lib/meetingLinks'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'] as const

interface SoftPhoneProps {
  number: string
  onNumberChange: (value: string) => void
  onCall: () => void
  onHangup: () => void
  onLandline: () => void
  live: boolean
  disabled?: boolean
}

export function SoftPhone({
  number,
  onNumberChange,
  onCall,
  onHangup,
  onLandline,
  live,
  disabled,
}: SoftPhoneProps) {
  const press = (key: string) => {
    if (disabled || live) return
    if (key === '*' || key === '#') {
      onNumberChange(number + key)
      return
    }
    const digits = (number.replace(/\D/g, '') + key).slice(0, 15)
    onNumberChange(normalizePhoneDisplay(digits))
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-(--shadow-card)">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-brand text-lg font-semibold text-navy-900">Softphone / Landline</h3>
        <span className="text-[10px] tracking-[0.08em] text-ink-subtle uppercase">PSTN dialer</span>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        Dial any mobile or landline. Live captions capture the conversation into the CRM.
      </p>

      <input
        value={number}
        onChange={(e) => onNumberChange(e.target.value)}
        placeholder="(555) 000-0000"
        disabled={live || disabled}
        className="mt-4 h-12 w-full rounded-xl border border-border bg-canvas px-4 text-center font-mono text-lg tracking-wide text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
      />

      <div className="mt-3 grid grid-cols-3 gap-2">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            disabled={live || disabled}
            onClick={() => press(key)}
            className="flex h-12 items-center justify-center rounded-xl border border-border bg-canvas text-lg font-semibold text-ink transition-colors hover:bg-accent-soft disabled:opacity-40"
          >
            {key}
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={live || disabled}
          onClick={() => onNumberChange(number.slice(0, -1))}
          className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border text-sm font-semibold text-ink-muted hover:bg-canvas disabled:opacity-40"
        >
          <Delete className="h-4 w-4" />
          Clear
        </button>
        {!live ? (
          <button
            type="button"
            disabled={disabled || number.replace(/\D/g, '').length < 3}
            onClick={onCall}
            className="inline-flex h-11 flex-[1.4] items-center justify-center gap-1.5 rounded-xl bg-success text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40"
          >
            <Phone className="h-4 w-4" />
            Call
          </button>
        ) : (
          <button
            type="button"
            onClick={onHangup}
            className="inline-flex h-11 flex-[1.4] items-center justify-center gap-1.5 rounded-xl bg-attention text-sm font-semibold text-white hover:brightness-110"
          >
            <PhoneOff className="h-4 w-4" />
            End
          </button>
        )}
      </div>

      <button
        type="button"
        disabled={live || disabled || number.replace(/\D/g, '').length < 3}
        onClick={onLandline}
        className="mt-2 flex h-10 w-full items-center justify-center rounded-xl border border-navy-800/20 bg-navy-900 text-xs font-semibold tracking-wide text-white uppercase hover:bg-navy-800 disabled:opacity-40"
      >
        Connect landline (tel:)
      </button>
    </div>
  )
}
