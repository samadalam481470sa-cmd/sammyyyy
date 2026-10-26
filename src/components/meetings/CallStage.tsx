import { useEffect, useRef } from 'react'
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  MonitorUp,
  Users,
} from 'lucide-react'
import { channelLabel, formatDuration } from '@/lib/meetingLinks'
import type { MeetingChannel } from '@/types/meetings'

interface CallStageProps {
  live: boolean
  channel: MeetingChannel
  title: string
  participantName: string
  elapsed: number
  camOn: boolean
  micOn: boolean
  onToggleCam: () => void
  onToggleMic: () => void
  onHangup: () => void
  onShareScreen?: () => void
  stream: MediaStream | null
}

export function CallStage({
  live,
  channel,
  title,
  participantName,
  elapsed,
  camOn,
  micOn,
  onToggleCam,
  onToggleMic,
  onHangup,
  onShareScreen,
  stream,
}: CallStageProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.srcObject = stream
    if (stream) void el.play().catch(() => undefined)
  }, [stream])

  return (
    <div className="flex min-h-[380px] flex-col overflow-hidden rounded-xl border border-navy-800 bg-navy-950 text-white shadow-(--shadow-elevated)">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{title || 'Newport meeting room'}</p>
          <p className="truncate text-[11px] text-white/50">
            {channelLabel(channel)}
            {participantName ? ` · ${participantName}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {live && (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-rose-200 uppercase">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
                Live
              </span>
              <span className="font-mono text-xs text-white/70">{formatDuration(elapsed)}</span>
            </>
          )}
        </div>
      </div>

      <div className="relative grid flex-1 place-items-center bg-[radial-gradient(ellipse_at_center,_rgba(61,126,184,0.18),_transparent_55%)] p-4">
        {live && stream && camOn ? (
          <video
            ref={videoRef}
            muted
            playsInline
            className="max-h-[280px] w-full max-w-xl rounded-xl border border-white/10 object-cover shadow-lg"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-accent/25 text-3xl font-bold text-accent-soft">
              {(participantName || 'N').slice(0, 1).toUpperCase()}
            </div>
            <p className="text-sm text-white/70">
              {live
                ? camOn
                  ? 'Connecting camera…'
                  : 'Camera off — audio / phone mode'
                : 'Start a face call, platform join, or softphone session'}
            </p>
            {live && (
              <div className="mt-2 flex items-center gap-2 text-xs text-white/45">
                <Users className="h-3.5 w-3.5" />
                You + {participantName || 'participant'}
              </div>
            )}
          </div>
        )}

        {live && stream && camOn && (
          <div className="absolute right-5 bottom-5 h-28 w-40 overflow-hidden rounded-lg border border-white/20 bg-navy-900 shadow-lg">
            <video
              ref={(el) => {
                if (el && stream) {
                  el.srcObject = stream
                  void el.play().catch(() => undefined)
                }
              }}
              muted
              playsInline
              className="h-full w-full object-cover"
            />
            <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1.5 py-0.5 text-[9px] uppercase">
              You
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-3 border-t border-white/10 bg-navy-900/80 px-4 py-3">
        <button
          type="button"
          disabled={!live}
          onClick={onToggleMic}
          className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors disabled:opacity-30 ${
            micOn ? 'bg-white/10 hover:bg-white/15' : 'bg-attention hover:brightness-110'
          }`}
          title={micOn ? 'Mute' : 'Unmute'}
        >
          {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </button>
        <button
          type="button"
          disabled={!live || channel === 'phone' || channel === 'landline'}
          onClick={onToggleCam}
          className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors disabled:opacity-30 ${
            camOn ? 'bg-white/10 hover:bg-white/15' : 'bg-attention hover:brightness-110'
          }`}
          title={camOn ? 'Stop camera' : 'Start camera'}
        >
          {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </button>
        <button
          type="button"
          disabled={!live}
          onClick={onShareScreen}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/15 disabled:opacity-30"
          title="Share screen"
        >
          <MonitorUp className="h-5 w-5" />
        </button>
        <button
          type="button"
          disabled={!live}
          onClick={onHangup}
          className="ml-2 flex h-12 w-12 items-center justify-center rounded-full bg-rose-600 hover:bg-rose-500 disabled:opacity-30"
          title="Leave"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
