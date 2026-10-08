import { useEffect, useMemo, useRef, useState } from 'react'
import { Lock, Mic, Phone, Users, Video } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { sessionOwnerKey } from '@/lib/ownerKey'
import { ALL_TEAM_MEMBERS, TEAM_SLOT_MEMBERS, defaultInvitees, memberByOwnerKey } from '@/lib/teamRoster'
import { newHuddleRoomId } from '@/lib/huddleCrypto'
import {
  isInvited,
  loadHuddleRoom,
  saveHuddleRoom,
  type HuddleRoom,
} from '@/lib/huddleSignaling'
import { startHuddleSession, type HuddleSession, type RemoteFeed } from '@/lib/huddleRtc'

function RemoteTile({ ownerKey, stream }: RemoteFeed) {
  const ref = useRef<HTMLVideoElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.srcObject = stream
    void el.play().catch(() => undefined)
  }, [stream])
  const member = memberByOwnerKey(ownerKey)
  return (
    <div className="relative overflow-hidden rounded-lg border border-white/10 bg-navy-900">
      <video ref={ref} autoPlay playsInline className="h-24 w-full object-cover" />
      <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1.5 py-0.5 text-[9px] text-white">
        {member?.name ?? ownerKey}
      </span>
    </div>
  )
}

export function TeamHuddle() {
  const { user } = useAuth()
  const ownerKey = sessionOwnerKey(user)
  const isManager = Boolean(user?.isManager)
  const [room, setRoom] = useState<HuddleRoom | null>(() => loadHuddleRoom())
  const [selected, setSelected] = useState<string[]>(() => defaultInvitees(isManager))
  const [video, setVideo] = useState(true)
  const [live, setLive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('Idle')
  const [remotes, setRemotes] = useState<RemoteFeed[]>([])
  const [peerKeys, setPeerKeys] = useState<string[]>([])
  const localRef = useRef<HTMLVideoElement | null>(null)
  const localStream = useRef<MediaStream | null>(null)
  const sessionRef = useRef<HuddleSession | null>(null)

  useEffect(() => {
    if (!isManager) setSelected(defaultInvitees(false))
  }, [isManager])

  useEffect(() => {
    const tick = window.setInterval(() => setRoom(loadHuddleRoom()), 1200)
    return () => window.clearInterval(tick)
  }, [])

  useEffect(() => {
    return () => {
      void sessionRef.current?.leave()
      localStream.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const invitedLocked = useMemo(() => TEAM_SLOT_MEMBERS.map((m) => m.ownerKey), [])
  const canJoinExisting = isInvited(room, ownerKey) && room?.roomId !== undefined

  const attachLocal = (stream: MediaStream) => {
    localStream.current = stream
    const el = localRef.current
    if (el) {
      el.srcObject = stream
      void el.play().catch(() => undefined)
    }
  }

  const start = async (existing: HuddleRoom | null) => {
    setError(null)
    const invitees = isManager ? selected : invitedLocked
    if (invitees.length === 0) {
      setError('Select at least one key to add.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: video ? { width: { ideal: 640 }, height: { ideal: 360 } } : false,
      })
      attachLocal(stream)
      const nextRoom: HuddleRoom = existing ?? {
        roomId: newHuddleRoomId(),
        hostKey: ownerKey,
        invited: [...new Set([...invitees, ownerKey])],
        video,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      }
      if (!existing && isManager) {
        nextRoom.invited = [...new Set([...invitees, ownerKey])]
      }
      if (!isInvited(nextRoom, ownerKey)) {
        stream.getTracks().forEach((t) => t.stop())
        setError('This huddle is not open to your key.')
        return
      }
      saveHuddleRoom(nextRoom)
      setRoom(nextRoom)
      sessionRef.current = await startHuddleSession({
        ownerKey,
        roomId: nextRoom.roomId,
        localStream: stream,
        onRemote: setRemotes,
        onPeerKeys: setPeerKeys,
        onError: (message) => setError(message),
      })
      setLive(true)
      setStatus('Encrypted huddle live · DTLS-SRTP')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Camera / microphone permission is required to join the team call.',
      )
    }
  }

  const leave = async () => {
    await sessionRef.current?.leave()
    sessionRef.current = null
    localStream.current = null
    setLive(false)
    setRemotes([])
    setPeerKeys([])
    setStatus('Left huddle')
    const current = loadHuddleRoom()
    if (current && current.hostKey === ownerKey) {
      saveHuddleRoom(null)
      setRoom(null)
    }
  }

  const toggle = (owner: string) => {
    if (!isManager || live) return
    setSelected((prev) => (prev.includes(owner) ? prev.filter((id) => id !== owner) : [...prev, owner]))
  }

  return (
    <section className="rounded-xl border border-border bg-surface shadow-(--shadow-card)">
      <div className="flex items-center gap-2 border-b border-border px-3 py-3">
        <Users className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-semibold text-navy-900">Join meeting with team</h2>
        <Lock className="ml-auto h-3.5 w-3.5 text-ink-subtle" />
      </div>
      <div className="space-y-3 p-3">
        <p className="text-[11px] leading-relaxed text-ink-subtle">
          Encrypted video / voice huddle for Newport keys. Media is peer-to-peer DTLS-SRTP. Signaling
          is AES-GCM sealed. Partner keys are included automatically; the managerial key chooses who
          to add.
        </p>

        <div className="space-y-1.5">
          {(isManager ? ALL_TEAM_MEMBERS : TEAM_SLOT_MEMBERS).map((m) => {
            const checked = isManager ? selected.includes(m.ownerKey) : true
            const connected = peerKeys.includes(m.ownerKey) || (live && m.ownerKey === ownerKey)
            return (
              <label
                key={m.ownerKey}
                className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs ${
                  checked ? 'border-accent/30 bg-accent-soft/40' : 'border-border'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!isManager || live || m.ownerKey === ownerKey}
                  onChange={() => toggle(m.ownerKey)}
                  className="accent-navy-900"
                />
                <span className="flex-1 text-ink">{m.name}</span>
                {m.ownerKey === ownerKey && (
                  <span className="text-[10px] font-semibold text-accent uppercase">You</span>
                )}
                {connected && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
              </label>
            )
          })}
        </div>

        {!isManager && (
          <p className="text-[11px] text-ink-muted">
            All five partner keys are on this huddle. The managerial key is not auto-added.
          </p>
        )}
        {isManager && (
          <p className="text-[11px] text-ink-muted">Select which key names join this huddle.</p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={live}
            onClick={() => setVideo(true)}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${
              video ? 'bg-navy-900 text-white' : 'border border-border text-ink-muted'
            }`}
          >
            <Video className="h-3.5 w-3.5" />
            Video
          </button>
          <button
            type="button"
            disabled={live}
            onClick={() => setVideo(false)}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${
              !video ? 'bg-navy-900 text-white' : 'border border-border text-ink-muted'
            }`}
          >
            <Mic className="h-3.5 w-3.5" />
            Voice
          </button>
        </div>

        {live ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-navy-950 p-2">
              <div className="relative overflow-hidden rounded-lg border border-white/10">
                <video
                  ref={localRef}
                  muted
                  autoPlay
                  playsInline
                  className={`h-24 w-full object-cover ${video ? '' : 'hidden'}`}
                />
                {!video && (
                  <div className="grid h-24 place-items-center text-[11px] text-white/70">You · voice</div>
                )}
                <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1.5 py-0.5 text-[9px] text-white">
                  You
                </span>
              </div>
              {remotes.map((feed) => (
                <RemoteTile key={feed.ownerKey} {...feed} />
              ))}
            </div>
            <button
              type="button"
              onClick={() => void leave()}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-rose-700 text-sm font-semibold text-white hover:bg-rose-600"
            >
              <Phone className="h-4 w-4" />
              Leave team call
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {canJoinExisting && (
              <button
                type="button"
                onClick={() => void start(room)}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent text-sm font-semibold text-white hover:bg-accent-hover"
              >
                <Users className="h-4 w-4" />
                Join live team huddle
              </button>
            )}
            <button
              type="button"
              onClick={() => void start(null)}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-navy-900 text-sm font-semibold text-white hover:bg-navy-800"
            >
              <Users className="h-4 w-4" />
              {video ? 'Start encrypted video huddle' : 'Start encrypted voice huddle'}
            </button>
          </div>
        )}

        <p className="text-[11px] text-ink-subtle">{status}</p>
        {error && (
          <p className="rounded-md border border-attention-border bg-attention-bg px-2 py-1.5 text-[11px] text-attention">
            {error}
          </p>
        )}
      </div>
    </section>
  )
}
