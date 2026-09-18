import { held, type SessionHolding } from './session-holding'
import { now as appNow } from '@/data/fixtures/clock'
import { activities as fixtureActivities } from '@/data/fixtures/activities'
import type {
  Activity,
  ActivityId,
  ActivityStanding,
  AttendanceState,
  IsoDateTime,
  ResidentId,
  SiteId,
  StaffRef,
} from '../types'

/**
 * Planning, changing and cancelling a session. AM v2.0 ACT-01, Phase 20.
 *
 * **Cancelling never removes an attendance record**, and that is the whole of
 * the design here. AM v2.0 says a confirmation asks before removing partially
 * recorded attendance; this build does not remove it and the confirmation says
 * what stays instead. Somebody wrote that a resident came, with their name and
 * the time on it, and a later decision about the session does not make that
 * untrue — a cancellation that discarded them would be a record editing
 * itself, which is the shape consent withdrawal refused for the same reason.
 *
 * So `cancel` writes a standing beside the record and touches neither
 * `invited` nor `joined`. There is no code path from here to either.
 *
 * **Edits are field by field on a session, never a re-save of the whole
 * thing.** A session edited by replacing it loses whoever planned it and when,
 * which is the attribution every record in this build carries.
 */

interface Edit {
  name?: string
  place?: string
  startsAt?: IsoDateTime
  endsAt?: IsoDateTime
  standing?: ActivityStanding
  /**
   * Who came, recorded this session. CW PRD ACT-02.
   *
   * **Keyed by resident, never a replacement invitation list.** A session
   * recorded by swapping the list would lose whoever was invited and never
   * answered — the denominator every figure on these screens counts over, and
   * the state the third member of `AttendanceState` exists to hold.
   */
  attendance?: Map<ResidentId, AttendanceState>
}

const edits = new Map<ActivityId, Edit>()
const added: Activity[] = []
let planned = 0
let changed = 0
let cancelled = 0
let recorded = 0

/** The session as it stands: fixture, plus whatever this session wrote. */
export function withActivityEdits(activity: Activity): Activity {
  const edit = edits.get(activity.id)
  if (edit === undefined) return activity
  const attendance = edit.attendance
  return {
    ...activity,
    name: edit.name ?? activity.name,
    place: edit.place ?? activity.place,
    startsAt: edit.startsAt ?? activity.startsAt,
    endsAt: edit.endsAt ?? activity.endsAt,
    standing: edit.standing ?? activity.standing,
    invited:
      attendance === undefined
        ? activity.invited
        : activity.invited.map((entry) => {
            const recorded = attendance.get(entry.residentId)
            return recorded === undefined ? entry : { ...entry, attendance: recorded }
          }),
  }
}

/** Every session at a site, the fixtures' and this session's, as they stand. */
export function activitiesAt(siteId: SiteId): Activity[] {
  return [...fixtureActivities, ...added]
    .filter((activity) => activity.siteId === siteId)
    .map(withActivityEdits)
}

export const addedThisSession = (id: ActivityId): boolean =>
  added.some((activity) => activity.id === id)

export const changedThisSession = (id: ActivityId): boolean => edits.has(id)

/**
 * A new session.
 *
 * **Invited is the denominator and it is asked for here**, because a session
 * planned for nobody makes every figure about it meaningless: "0 of 0 came"
 * and "nobody was asked" are different facts and the first reads as the
 * second. The form gates on at least one.
 */
export function planSession(input: {
  siteId: SiteId
  name: string
  description: string
  place: string
  startsAt: IsoDateTime
  endsAt: IsoDateTime
  residentIds: string[]
  by: StaffRef
}): Activity {
  if (input.residentIds.length === 0)
    throw new Error('A session needs at least one resident invited.')

  const activity: Activity = {
    id: `act-session-${String(added.length + 1).padStart(3, '0')}` as ActivityId,
    standing: { kind: 'planned' },
    siteId: input.siteId,
    name: input.name,
    description: input.description,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    place: input.place,
    plannedBy: input.by,
    plannedAt: appNow().toISOString() as IsoDateTime,
    invited: input.residentIds.map((residentId) => ({
      residentId: residentId as Activity['invited'][number]['residentId'],
      attendance: { kind: 'not_recorded' },
    })),
    joined: [],
  }
  added.push(activity)
  planned += 1
  return activity
}

/** Change what a session is or where it is. Never who planned it. */
export function editSession(id: ActivityId, fields: Omit<Edit, 'standing'>): void {
  edits.set(id, { ...edits.get(id), ...fields })
  changed += 1
}

/**
 * Call it off, with a reason, keeping everything already recorded.
 *
 * Refuses an empty reason rather than storing one: a cancelled session whose
 * reason is blank is a decision with nobody's account of it, and the screen
 * would render a gap nobody can close because the moment has passed.
 */
export function cancelSession(
  activity: Activity,
  reason: string,
  by: StaffRef,
): ActivityStanding {
  if (reason.trim() === '') throw new Error('A cancellation needs a reason.')
  if (activity.standing.kind === 'cancelled')
    throw new Error(
      `${activity.name} was already cancelled by ${activity.standing.by.fullName}.`,
    )

  const standing: ActivityStanding = {
    kind: 'cancelled',
    reason: reason.trim(),
    by,
    at: appNow().toISOString() as IsoDateTime,
  }
  edits.set(activity.id, { ...edits.get(activity.id), standing })
  cancelled += 1
  return standing
}

/**
 * Who came, for one session. CW PRD ACT-02.
 *
 * **Only the residents somebody answered for.** A resident left unanswered
 * keeps `not_recorded`, which is the gap the calendar counts: recording six of
 * fourteen writes six answers and leaves eight saying nobody wrote them down,
 * rather than eight saying nobody came.
 *
 * Refused where a session names nobody, and where an answer names a resident
 * the session never invited: an attendance record against somebody who was not
 * on the list is the wrong-subject failure with a grid around it.
 */
export function recordAttendance(
  activity: Activity,
  answers: { residentId: ResidentId; attendance: AttendanceState }[],
): number {
  if (answers.length === 0) throw new Error('Nothing was recorded.')
  const invited = new Set(activity.invited.map((entry) => entry.residentId))
  for (const answer of answers) {
    if (!invited.has(answer.residentId))
      throw new Error(
        `${answer.residentId} was not invited to ${activity.name}, so their attendance cannot be recorded here.`,
      )
  }

  const edit = edits.get(activity.id)
  const attendance = new Map(edit?.attendance ?? [])
  for (const answer of answers) attendance.set(answer.residentId, answer.attendance)
  edits.set(activity.id, { ...edit, attendance })
  recorded += answers.length
  return answers.length
}

export function activityHoldings(): SessionHolding[] {
  return [
    ...held('sessions you planned', planned),
    ...held('sessions you changed', changed),
    ...held('sessions you cancelled', cancelled),
    ...held('attendance answers you recorded', recorded),
  ]
}

/** Emptied on sign out, and by tests. */
export function resetSessionActivities(): void {
  edits.clear()
  added.length = 0
  planned = 0
  changed = 0
  cancelled = 0
  recorded = 0
}
