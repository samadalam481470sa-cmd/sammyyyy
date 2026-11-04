import { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { DrawerHeader, SideDrawer } from '@/components/shared/Overlay'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { UnsavedChangesDialog } from '@/components/shared/UnsavedChangesDialog'
import { ProfileLinkButton } from '@/components/profile/ProfileLinkButton'
import { MeetingDetailsBody, MeetingSaveBar, MeetingTranscriptPanel, meetingWhen } from '@/components/meetings/MeetingPanels'
import { useMeetingController, type MeetingsApi } from '@/components/meetings/useMeetingController'
import { meetingTitle, type CrmMeeting } from '@/types/crmMeeting'

interface Props {
  api: MeetingsApi
  meeting: CrmMeeting | null
  onClose: () => void
  /** Hide "View Full Opportunity Profile" when already on that profile. */
  hideProfileLink?: boolean
}

/**
 * Full-height navy-header drawer for one saved meeting: details, transcript, AI summary and
 * actions. Used by Meeting History and the Opportunity Profile; the same record as Meetings.
 */
export function MeetingDrawer({ api, meeting, onClose, hideProfileLink = false }: Props) {
  // The body owns the unsaved-change check; Escape and the backdrop go through it.
  const closeRef = useRef<(() => void) | null>(null)
  return (
    <SideDrawer open={Boolean(meeting)} onRequestClose={() => (closeRef.current ? closeRef.current() : onClose())} label="Meeting details" width="max-w-[640px]" testId="meeting-drawer">
      {meeting && <MeetingDrawerBody key={meeting.id} api={api} meeting={meeting} onClose={onClose} hideProfileLink={hideProfileLink} closeRef={closeRef} />}
    </SideDrawer>
  )
}

function MeetingDrawerBody({ api, meeting, onClose, hideProfileLink, closeRef }: { api: MeetingsApi; meeting: CrmMeeting; onClose: () => void; hideProfileLink: boolean; closeRef: React.MutableRefObject<(() => void) | null> }) {
  const ctl = useMeetingController(api, meeting)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [leavePrompt, setLeavePrompt] = useState(false)
  const project = ctl.opportunities.find((o) => o.id === ctl.current.opportunityId)
  const unsaved = Boolean(ctl.stored) && ctl.dirty
  const requestClose = () => (unsaved ? setLeavePrompt(true) : onClose())
  closeRef.current = requestClose

  return (
    <div className="flex h-full min-h-0 flex-col">
      <DrawerHeader eyebrow={project ? project.projectName : 'Meeting'} title={meetingTitle({ displayTitle: ctl.draft.displayTitle, outlookSubject: ctl.current.outlookSubject })} subtitle={meetingWhen(ctl.current)} onClose={requestClose} closeLabel="Close meeting details">
        <p className="text-[11px] text-white/70">Private to you · {ctl.current.outlookEventId ? 'from your Outlook calendar' : 'added to CRM history'} · the Outlook event is never changed here</p>
      </DrawerHeader>
      <div className="custom-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="px-5 py-4">
          <MeetingDetailsBody ctl={ctl} compact />
        </div>
        <div className="mx-5 mb-5 overflow-hidden rounded-xl border border-border">
          <MeetingTranscriptPanel ctl={ctl} fill={false} />
        </div>
      </div>
      <MeetingSaveBar
        ctl={ctl}
        extra={
          ctl.stored ? (
            <button type="button" onClick={() => setConfirmRemove(true)} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-bg)] px-3 text-sm font-semibold text-[var(--color-danger)]" data-testid="remove-meeting">
              <Trash2 className="h-4 w-4" /> Remove
            </button>
          ) : undefined
        }
      />
      {!hideProfileLink && (
        <div className="shrink-0 bg-surface px-4 pb-3">
          <ProfileLinkButton opportunityId={ctl.current.opportunityId} />
        </div>
      )}
      <ConfirmDialog
        open={confirmRemove}
        title="Remove from CRM History?"
        message="This removes the CRM meeting record, its transcript and summary from your private history in this browser. The Outlook event and any external recording are not changed or deleted. Tasks already created stay."
        confirmLabel="Remove from History"
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => {
          setConfirmRemove(false)
          void api.remove(ctl.current.id).then(onClose)
        }}
      />
      <UnsavedChangesDialog
        open={leavePrompt}
        saving={false}
        error={ctl.error}
        recordLabel="meeting"
        onSave={() => {
          const saved = ctl.save()
          if (saved) {
            setLeavePrompt(false)
            onClose()
          }
        }}
        onDiscard={() => {
          setLeavePrompt(false)
          onClose()
        }}
        onCancel={() => setLeavePrompt(false)}
      />
    </div>
  )
}
