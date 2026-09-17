import type {
  CareNote,
  IsoDate,
  IsoDateTime,
  Resident,
  Shift,
  StaffId,
} from '@/data/types'
import type { TimeZone } from '@/lib/format'
import { zonedDate, zonedWallClock } from '@/lib/format'
import { SHIFTS } from '@/lib/shift'

/**
 * The questions the care notes list answers. CN-01.
 *
 * **The same records as a resident's tab, a different question**: what is
 * waiting across the residents this person can see, rather than what happened
 * to one of them. So the screen is questions, and the default is the one with
 * nowhere else to be answered: notes somebody asked a senior to look at.
 *
 * **No "By author" view, and no colleague picker.** The PRD lists one. Browsing a
 * named colleague's notes, from a care worker's screen, is a record about a
 * person rather than about a home, which is the blame the scope rule stops
 * (docs/DEPARTURES.md). The viewer's own notes are one view, because a person
 * reading back what they wrote is not supervising anybody.
 *
 * Every function is pure and takes the moment and the home's timezone, so
 * "today" is the home's day rather than the machine's, and each is tested on
 * its own.
 */

export type CareNotesView =
  'flagged' | 'quiet_today' | 'yours' | 'by_shift' | 'everything'

export const CARE_NOTES_VIEWS: { id: CareNotesView; label: string }[] = [
  { id: 'flagged', label: 'Flagged, not reviewed' },
  { id: 'quiet_today', label: 'No note today' },
  { id: 'yours', label: 'Your notes' },
  { id: 'by_shift', label: 'By shift' },
  { id: 'everything', label: 'All notes' },
]

export interface NoteWithResident {
  note: CareNote
  resident: Resident
}

/** Notes about the given residents only, each with who it is about. */
function withResidents(notes: CareNote[], residents: Resident[]): NoteWithResident[] {
  const byId = new Map(residents.map((resident) => [resident.id, resident]))
  return notes.flatMap((note) => {
    const resident = byId.get(note.residentId)
    return resident === undefined ? [] : [{ note, resident }]
  })
}

const newestFirst = (a: NoteWithResident, b: NoteWithResident) =>
  new Date(b.note.recordedAt).getTime() - new Date(a.note.recordedAt).getTime()

/**
 * Flagged and not yet reviewed, **oldest flag first**. A queue sorted newest
 * first buries the note that has waited three days under this morning's.
 */
export function flaggedNotReviewed(
  notes: CareNote[],
  residents: Resident[],
): NoteWithResident[] {
  const flaggedAt = (item: NoteWithResident) =>
    item.note.review.kind === 'flagged_not_reviewed'
      ? new Date(item.note.review.flaggedAt).getTime()
      : 0
  return withResidents(
    notes.filter((note) => note.review.kind === 'flagged_not_reviewed'),
    residents,
  ).sort((a, b) => flaggedAt(a) - flaggedAt(b))
}

/**
 * When the longest-waiting flag was raised, or `nothing_waiting`. A named
 * answer rather than an undefined one: nothing waiting is a finding.
 */
export function oldestFlag(
  flagged: NoteWithResident[],
): { kind: 'waiting_since'; at: IsoDateTime } | { kind: 'nothing_waiting' } {
  const first = flagged[0]
  if (first === undefined || first.note.review.kind !== 'flagged_not_reviewed')
    return { kind: 'nothing_waiting' }
  return { kind: 'waiting_since', at: first.note.review.flaggedAt }
}

export interface QuietResident {
  resident: Resident
  /** Their most recent note, or `never` when nobody has ever written them up. */
  last: CareNote | 'never'
}

/**
 * Residents with no note today, in the home's day.
 *
 * **Never written up leads**, and stays distinct from "nothing today": a
 * resident nobody has ever written about is the worse finding, and it must not
 * sit below somebody written up an hour before midnight.
 */
export function withoutNoteToday(
  residents: Resident[],
  notes: CareNote[],
  timeZone: TimeZone,
  now: IsoDateTime,
): QuietResident[] {
  const today: IsoDate = zonedDate(now, timeZone)
  const latest = new Map<string, CareNote>()
  const wroteToday = new Set<string>()

  for (const note of notes) {
    const previous = latest.get(note.residentId)
    if (previous === undefined || previous.recordedAt < note.recordedAt)
      latest.set(note.residentId, note)
    if (zonedDate(note.recordedAt, timeZone) === today) wroteToday.add(note.residentId)
  }

  const lastTime = (quiet: QuietResident) =>
    quiet.last === 'never'
      ? Number.NEGATIVE_INFINITY
      : new Date(quiet.last.recordedAt).getTime()

  return residents
    .filter((resident) => !wroteToday.has(resident.id))
    .map((resident): QuietResident => ({
      resident,
      last: latest.get(resident.id) ?? 'never',
    }))
    .sort((a, b) => lastTime(a) - lastTime(b))
}

/** Every note written today, in the home's day, newest first. */
export function notesToday(
  notes: CareNote[],
  residents: Resident[],
  timeZone: TimeZone,
  now: IsoDateTime,
): NoteWithResident[] {
  const today: IsoDate = zonedDate(now, timeZone)
  return withResidents(
    notes.filter((note) => zonedDate(note.recordedAt, timeZone) === today),
    residents,
  ).sort(newestFirst)
}

/** Every note, newest first. Paged by the screen, never cut here. */
export function allNotes(notes: CareNote[], residents: Resident[]): NoteWithResident[] {
  return withResidents(notes, residents).sort(newestFirst)
}

/**
 * The notes the viewer wrote, newest first.
 *
 * **Only ever the viewer's own.** There is no function here that takes somebody
 * else's id, so no screen can build a colleague picker on top of this file.
 */
export function yourNotes(
  notes: CareNote[],
  residents: Resident[],
  viewer: StaffId,
): NoteWithResident[] {
  return withResidents(
    notes.filter((note) => note.recordedBy.id === viewer),
    residents,
  ).sort(newestFirst)
}

/** Notes written on one shift today, newest first. */
export function byShift(
  notes: CareNote[],
  residents: Resident[],
  shift: Shift,
  timeZone: TimeZone,
  now: IsoDateTime,
): NoteWithResident[] {
  const today: IsoDate = zonedDate(now, timeZone)
  return withResidents(
    notes.filter(
      (note) =>
        note.shift.value === shift && zonedDate(note.recordedAt, timeZone) === today,
    ),
    residents,
  ).sort(newestFirst)
}

/**
 * Residents nobody wrote about on a shift today.
 *
 * A legitimate absence claim **because the screen names the shift and the day
 * in the sentence that makes it**. It says this shift did not write about them,
 * never that nobody did.
 */
export function withoutNoteOnShift(
  residents: Resident[],
  notes: CareNote[],
  shift: Shift,
  timeZone: TimeZone,
  now: IsoDateTime,
): Resident[] {
  const covered = new Set(
    byShift(notes, residents, shift, timeZone, now).map((item) => item.resident.id),
  )
  return residents.filter((resident) => !covered.has(resident.id))
}

/**
 * Whether a shift has begun today, in the home's wall clock.
 *
 * **A shift that has not started cannot have missed anybody.** At 10:00 every
 * resident has no note on the late shift, and hatching all of them would claim
 * a gap for hours that have not happened. The night shift has always begun on
 * a given day, because its early hours, midnight to 07:00, belong to that day.
 */
export function shiftHasBegun(
  shift: Shift,
  timeZone: TimeZone,
  now: IsoDateTime,
): boolean {
  if (shift === 'night') return true
  const hour = new Date(zonedWallClock(now, timeZone)).getUTCHours()
  const found = SHIFTS.find((entry) => entry.id === shift)
  if (found === undefined) throw new Error(`No shift ${shift}`)
  return hour >= found.from
}

/** How many different people wrote these notes. A count, never a list of names. */
export function authorCount(notes: CareNote[]): number {
  return new Set(notes.map((note) => note.recordedBy.id)).size
}
