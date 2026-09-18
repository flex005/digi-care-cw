import type { Activity, IsoDate, IsoDateTime, ResidentId } from '@/data/types'
import type { TimeZone } from '@/lib/format'
import { zonedDate, zonedWallClock } from '@/lib/format'

/**
 * The week a calendar shows, and what the sessions in it add up to. CW PRD
 * ACT-01.
 *
 * Pure, and every instant passed in, so a test asserts the arithmetic rather
 * than the day the suite runs.
 *
 * **Reckoned in the home's zone, never the reader's.** A session at 09:00 in
 * London belongs to that London day whoever is looking and wherever they are.
 */

/** Monday to Sunday, as the calendar's seven columns. */
export const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const

/** The Monday of the week an instant falls in, as a date in the home's zone. */
export function mondayOf(at: IsoDateTime, timeZone: TimeZone, weeks = 0): IsoDate {
  const wall = new Date(zonedWallClock(at, timeZone))
  const day = (wall.getUTCDay() + 6) % 7
  wall.setUTCDate(wall.getUTCDate() - day + weeks * 7)
  return wall.toISOString().slice(0, 10) as IsoDate
}

/** The seven dates of the week beginning on this Monday. */
export function weekDates(monday: IsoDate): IsoDate[] {
  return WEEKDAYS.map((_, index) => {
    const day = new Date(`${monday}T00:00:00.000Z`)
    day.setUTCDate(day.getUTCDate() + index)
    return day.toISOString().slice(0, 10) as IsoDate
  })
}

/** The sessions of one week at one home, in the order they start. */
export function sessionsInWeek(
  activities: Activity[],
  monday: IsoDate,
  timeZone: TimeZone,
): Activity[] {
  const days = new Set(weekDates(monday))
  return activities
    .filter((activity) => days.has(zonedDate(activity.startsAt, timeZone)))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

/**
 * How much of one session's attendance is on the record.
 *
 * **The denominator is the invitation list**, always: counting attendees would
 * make a session nobody came to look the same as a session nobody wrote up.
 */
export interface SessionCounts {
  invited: number
  recorded: number
  attended: number
  didNotAttend: number
  notRecorded: number
  joined: number
}

export function countsOf(activity: Activity): SessionCounts {
  const states = activity.invited.map((entry) => entry.attendance.kind)
  return {
    invited: activity.invited.length,
    recorded: states.filter((kind) => kind !== 'not_recorded').length,
    attended: states.filter((kind) => kind === 'attended').length,
    didNotAttend: states.filter((kind) => kind === 'did_not_attend').length,
    notRecorded: states.filter((kind) => kind === 'not_recorded').length,
    joined: activity.joined.length,
  }
}

/**
 * Which of ACT-01's three states a card is in.
 *
 * `happened_nothing_recorded` is the one the screen exists for: the session is
 * over and nobody wrote down who came. `part_recorded` is a gap as well — the
 * residents nobody answered for are still unanswered — so it is drawn as
 * separate facts rather than as one amber card.
 */
export type SessionState =
  | { kind: 'ahead' }
  | { kind: 'happened_nothing_recorded' }
  | { kind: 'part_recorded'; notRecorded: number }
  | { kind: 'all_recorded' }
  | { kind: 'cancelled' }

export function sessionState(activity: Activity, at: IsoDateTime): SessionState {
  if (activity.standing.kind === 'cancelled') return { kind: 'cancelled' }
  const counts = countsOf(activity)
  const over = new Date(activity.endsAt).getTime() <= new Date(at).getTime()
  if (counts.notRecorded === 0 && counts.invited > 0) return { kind: 'all_recorded' }
  if (!over) return { kind: 'ahead' }
  if (counts.recorded === 0) return { kind: 'happened_nothing_recorded' }
  return { kind: 'part_recorded', notRecorded: counts.notRecorded }
}

/**
 * ACT-01's summary card: the sessions that happened with nobody written down,
 * and the people who were invited to them.
 *
 * **Residents, not invitations.** Two sessions can invite the same person, and
 * "29 residents were invited" would count them twice.
 */
export interface WeekSummary {
  sessions: number
  happenedWithNoRecord: number
  residentsInvited: number
}

export function summariseWeek(activities: Activity[], at: IsoDateTime): WeekSummary {
  const silent = activities.filter(
    (activity) => sessionState(activity, at).kind === 'happened_nothing_recorded',
  )
  const residents = new Set<ResidentId>()
  for (const activity of silent)
    for (const entry of activity.invited) residents.add(entry.residentId)

  return {
    sessions: activities.length,
    happenedWithNoRecord: silent.length,
    residentsInvited: residents.size,
  }
}
