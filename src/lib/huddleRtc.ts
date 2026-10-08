import {
  loadHuddleRoom,
  publishHuddleSignal,
  subscribeHuddleSignals,
  type HuddleWire,
} from '@/lib/huddleSignaling'

const ICE: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
]

export interface RemoteFeed {
  ownerKey: string
  stream: MediaStream
}

interface PeerSlot {
  pc: RTCPeerConnection
  makingOffer: boolean
  ignoreOffer: boolean
}

export interface HuddleSession {
  leave: () => Promise<void>
}

export async function startHuddleSession(opts: {
  ownerKey: string
  roomId: string
  localStream: MediaStream
  onRemote: (feeds: RemoteFeed[]) => void
  onPeerKeys: (keys: string[]) => void
  onError: (message: string) => void
}): Promise<HuddleSession> {
  const peers = new Map<string, PeerSlot>()
  const remotes = new Map<string, MediaStream>()
  let stopped = false

  const emitRemotes = () => opts.onRemote([...remotes.entries()].map(([ownerKey, stream]) => ({ ownerKey, stream })))
  const emitPeers = () => opts.onPeerKeys([...peers.keys()])

  const closePeer = (key: string) => {
    const slot = peers.get(key)
    if (!slot) return
    slot.pc.close()
    peers.delete(key)
    remotes.delete(key)
    emitRemotes()
    emitPeers()
  }

  const ensurePeer = (remoteKey: string): PeerSlot => {
    const existing = peers.get(remoteKey)
    if (existing) return existing
    const pc = new RTCPeerConnection({ iceServers: ICE, bundlePolicy: 'max-bundle' })
    const slot: PeerSlot = { pc, makingOffer: false, ignoreOffer: false }
    peers.set(remoteKey, slot)
    emitPeers()

    opts.localStream.getTracks().forEach((track) => {
      pc.addTrack(track, opts.localStream)
    })

    pc.onicecandidate = (ev) => {
      if (!ev.candidate || stopped) return
      void publishHuddleSignal(opts.roomId, {
        type: 'ice',
        from: opts.ownerKey,
        to: remoteKey,
        candidate: ev.candidate.toJSON(),
      })
    }

    pc.ontrack = (ev) => {
      const stream = ev.streams[0] ?? new MediaStream([ev.track])
      remotes.set(remoteKey, stream)
      emitRemotes()
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed' || pc.connectionState === 'disconnected') {
        if (pc.connectionState !== 'disconnected') closePeer(remoteKey)
      }
    }

    return slot
  }

  const polite = (remoteKey: string) => opts.ownerKey > remoteKey

  const handle = async (msg: HuddleWire) => {
    if (stopped) return
    if (msg.from === opts.ownerKey) return
    const room = loadHuddleRoom()
    if (!room || room.roomId !== opts.roomId) return
    if (!room.invited.includes(msg.from) && room.hostKey !== msg.from) return
    if (msg.type === 'kick' && msg.to === opts.ownerKey) {
      opts.onError('Removed from the team huddle')
      await leave()
      return
    }
    if (msg.type === 'bye') {
      closePeer(msg.from)
      return
    }
    if (msg.type === 'hello') {
      if (opts.ownerKey < msg.from) {
        await negotiate(msg.from)
      }
      return
    }
    if (msg.type === 'offer' && msg.to === opts.ownerKey) {
      const slot = ensurePeer(msg.from)
      const offerCollision = slot.makingOffer || slot.pc.signalingState !== 'stable'
      slot.ignoreOffer = !polite(msg.from) && offerCollision
      if (slot.ignoreOffer) return
      await slot.pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp })
      const answer = await slot.pc.createAnswer()
      await slot.pc.setLocalDescription(answer)
      void publishHuddleSignal(opts.roomId, {
        type: 'answer',
        from: opts.ownerKey,
        to: msg.from,
        sdp: answer.sdp || '',
      })
      return
    }
    if (msg.type === 'answer' && msg.to === opts.ownerKey) {
      const slot = peers.get(msg.from)
      if (!slot) return
      if (slot.pc.signalingState !== 'have-local-offer') return
      await slot.pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp })
      return
    }
    if (msg.type === 'ice' && msg.to === opts.ownerKey) {
      const slot = peers.get(msg.from)
      if (!slot) return
      try {
        await slot.pc.addIceCandidate(msg.candidate)
      } catch {
        // candidate arrived before remote description
      }
    }
  }

  const negotiate = async (remoteKey: string) => {
    const slot = ensurePeer(remoteKey)
    try {
      slot.makingOffer = true
      const offer = await slot.pc.createOffer()
      await slot.pc.setLocalDescription(offer)
      await publishHuddleSignal(opts.roomId, {
        type: 'offer',
        from: opts.ownerKey,
        to: remoteKey,
        sdp: offer.sdp || '',
      })
    } catch (err) {
      opts.onError(err instanceof Error ? err.message : 'Unable to negotiate huddle')
    } finally {
      slot.makingOffer = false
    }
  }

  const unsub = subscribeHuddleSignals(opts.roomId, (msg) => {
    void handle(msg)
  })

  await publishHuddleSignal(opts.roomId, {
    type: 'hello',
    from: opts.ownerKey,
    video: opts.localStream.getVideoTracks().some((t) => t.enabled),
  })

  const leave = async () => {
    if (stopped) return
    stopped = true
    unsub()
    try {
      await publishHuddleSignal(opts.roomId, { type: 'bye', from: opts.ownerKey })
    } catch {
      // ignore
    }
    for (const key of [...peers.keys()]) closePeer(key)
    opts.localStream.getTracks().forEach((t) => t.stop())
  }

  return { leave }
}
