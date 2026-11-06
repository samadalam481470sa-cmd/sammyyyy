/** Heights the bell drawer is laid out with (px). Rows are compact; numbers match the rendered markup. */
export const BELL_SIZES = {
  /** A section's heading line plus its "View all" line and the divider under it. */
  section: 56,
  /** One meeting or overdue-task row (two lines). */
  row: 50,
  /** One unread email row (two lines). */
  mailRow: 52,
  /** The mail section when it shows a message instead of rows (not connected, all caught up, error). */
  mailNotice: 160,
}

export interface BellCounts {
  meetings: number
  tasks: number
  mail: number
  /** False when the mailbox shows a notice block instead of rows. */
  mailRows?: boolean
}

export interface BellAllocation {
  meetings: number
  tasks: number
  mail: number
}

/**
 * How many preview rows of each group fit in `height` pixels, so the drawer needs no scrollbar.
 * - Today's meetings come first and take whatever is left after the reserves below.
 * - At least one overdue task and one unread email are reserved whenever they exist, so neither group
 *   can push the other out of view.
 * - Remaining rows are shared between tasks and emails in turn.
 * When even the minimum does not fit (short window or heavy zoom), each group still shows one row and
 * the drawer scrolls instead of hiding controls. Totals are shown separately and never come from this.
 */
export function allocateBellSpace(counts: BellCounts, height: number, sizes = BELL_SIZES): BellAllocation {
  const { meetings, tasks, mail } = counts
  const mailRows = counts.mailRows !== false
  let left = height
  if (meetings > 0) left -= sizes.section
  if (tasks > 0) left -= sizes.section
  if (mailRows && mail > 0) left -= sizes.section
  else left -= sizes.mailNotice
  // Reserves for the lower groups.
  const taskReserve = tasks > 0 ? 1 : 0
  const mailReserve = mailRows && mail > 0 ? 1 : 0
  left -= taskReserve * sizes.row + mailReserve * sizes.mailRow
  const meetingRows = meetings > 0 ? Math.min(meetings, Math.max(1, Math.floor(left / sizes.row))) : 0
  left -= Math.max(0, meetingRows) * sizes.row
  let taskRows = taskReserve
  let mailShown = mailReserve
  // Share what is left, a task then an email, until both are shown or the space runs out.
  for (let turn = 0; ; turn += 1) {
    const wantTask = taskRows < tasks
    const wantMail = mailRows && mailShown < mail
    if (!wantTask && !wantMail) break
    const takeTask = wantTask && (!wantMail || turn % 2 === 0)
    const cost = takeTask ? sizes.row : sizes.mailRow
    if (left < cost) {
      // The other group may still fit a cheaper row.
      const otherCost = takeTask ? sizes.mailRow : sizes.row
      const otherWants = takeTask ? wantMail : wantTask
      if (otherWants && left >= otherCost) {
        if (takeTask) mailShown += 1
        else taskRows += 1
        left -= otherCost
        continue
      }
      break
    }
    if (takeTask) taskRows += 1
    else mailShown += 1
    left -= cost
  }
  return { meetings: meetingRows, tasks: taskRows, mail: mailRows ? mailShown : 0 }
}

export interface BellMeeting {
  id: string
  title: string
  start: string
  end: string
  platform: string | null
  past: boolean
}

interface EventLike {
  id: string
  subject?: string
  start: string
  end: string
  platform?: string | null
  isCancelled?: boolean
}

interface SavedLike {
  id: string
  outlookEventId?: string | null
  displayTitle?: string
  outlookSubject?: string
  start: string
  end: string
  platform?: string | null
}

/**
 * Today's meetings from this person's calendar, plus their own saved meetings not on it, each once.
 * Upcoming ones come before ones already over, and each group runs by start time.
 */
export function todaysMeetings(events: readonly EventLike[], saved: readonly SavedLike[], dayStart: Date, dayEnd: Date, now = new Date()): BellMeeting[] {
  const inDay = (iso: string) => {
    const at = new Date(iso).getTime()
    return at >= dayStart.getTime() && at < dayEnd.getTime()
  }
  const byId = new Map<string, BellMeeting>()
  const titled = (id: string, title: string, start: string, end: string, platform: string | null | undefined): BellMeeting => ({
    id,
    title: title.trim() || 'Untitled meeting',
    start,
    end,
    platform: platform ?? null,
    past: new Date(end).getTime() < now.getTime(),
  })
  for (const event of events) {
    if (event.isCancelled || !inDay(event.start)) continue
    byId.set(event.id, titled(event.id, event.subject ?? '', event.start, event.end, event.platform))
  }
  const onCalendar = (row: SavedLike) => {
    if (row.outlookEventId && byId.has(row.outlookEventId)) return true
    const title = (row.displayTitle || row.outlookSubject || '').trim().toLowerCase()
    return [...byId.values()].some((m) => m.start === row.start && m.title.toLowerCase() === title)
  }
  for (const row of saved) {
    if (!inDay(row.start) || onCalendar(row)) continue
    byId.set(row.id, titled(row.id, row.displayTitle || row.outlookSubject || '', row.start, row.end, row.platform))
  }
  return [...byId.values()].sort((a, b) => Number(a.past) - Number(b.past) || a.start.localeCompare(b.start))
}
