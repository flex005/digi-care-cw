import type { CareNote, IsoDate, IsoDateTime } from '@/data/types'
import { withoutNoteToday } from '@/features/notes/care-notes-views'
import { zonedDate, type TimeZone } from '@/lib/format'
import { MEDICATION_LOOKAHEAD_HOURS } from '@/lib/shift'
import type { DoseRecord, Person } from './phone-data'

/**
 * What is outstanding today for one person, most pressing first.
 *
 * **Four things, and only four, so a screen that finds none says which four it
 * looked at.** A dose whose window closed with nothing recorded; a dose given
 * that still waits for its second signature; a dose due now or within the
 * dashboard's look-ahead; and no care note today. Reviews past their date are
 * not here: a care worker cannot do one, and a work list is what the reader can
 * act on this shift. "Nothing outstanding" without the four named would be a
 * claim over everything from a check over part of it.
 *
 * **Each dose fact is per round and carries what it is out of**, the doses that
 * round asked of this person, because "2 not recorded" alone has no size.
 *
 * Every rule is asked of an owner that already answers it for the dashboard:
 * the home's day from `zonedDate`, a care note today from `withoutNoteToday`,
 * the look-ahead from `MEDICATION_LOOKAHEAD_HOURS`. A closed omission is not
 * outstanding — somebody looked and said why — though the chart still hatches
 * it, because closing a gap does not fill it.
 */
export type Outstanding =
  | { kind: 'doses_missed'; round: string; missed: number; due: number }
  | { kind: 'second_signature'; round: string; unsigned: number; due: number }
  | {
      kind: 'doses_due'
      round: string
      waiting: number
      due: number
      window: 'open' | 'opens_soon'
      opensAt: IsoDateTime
      closesAt: IsoDateTime
    }
  | { kind: 'no_note_today'; last: CareNote | 'never' }

export function outstandingFor(input: {
  person: Person
  records: DoseRecord[]
  notes: CareNote[]
  timeZone: TimeZone
  at: IsoDateTime
}): Outstanding[] {
  const { person, timeZone, at } = input
  const today: IsoDate = zonedDate(at, timeZone)
  const todays = input.records.filter(
    (record) =>
      record.residentId === person.id &&
      record.date === today &&
      record.state.kind !== 'not_due',
  )

  const rounds = [...new Set(todays.map((record) => record.roundTime))].sort()
  const missed: Outstanding[] = []
  const unsigned: Outstanding[] = []
  const open: Outstanding[] = []
  const soon: Outstanding[] = []
  const from = new Date(at).getTime()
  const to = from + MEDICATION_LOOKAHEAD_HOURS * 3_600_000

  for (const round of rounds) {
    const inRound = todays.filter((record) => record.roundTime === round)
    const due = inRound.length

    const omitted = inRound.filter(
      (record) =>
        record.state.kind === 'omitted' && record.state.closure.kind === 'open',
    ).length
    if (omitted > 0) missed.push({ kind: 'doses_missed', round, missed: omitted, due })

    const waitingWitness = inRound.filter(
      (record) =>
        record.state.kind === 'given' &&
        record.state.witness.kind === 'required_not_recorded',
    ).length
    if (waitingWitness > 0)
      unsigned.push({ kind: 'second_signature', round, unsigned: waitingWitness, due })

    const waiting = inRound.flatMap((record) =>
      record.state.kind === 'due' ? [record.state] : [],
    )
    const first = waiting[0]
    if (first === undefined) continue
    const opens = new Date(first.windowOpensAt).getTime()
    const closes = new Date(first.windowClosesAt).getTime()
    if (opens > to || closes <= from) continue
    const entry: Outstanding = {
      kind: 'doses_due',
      round,
      waiting: waiting.length,
      due,
      window: opens <= from ? 'open' : 'opens_soon',
      opensAt: first.windowOpensAt,
      closesAt: first.windowClosesAt,
    }
    if (entry.window === 'open') open.push(entry)
    else soon.push(entry)
  }

  const quiet = withoutNoteToday([person], input.notes, timeZone, at)[0]
  const note: Outstanding[] =
    quiet === undefined ? [] : [{ kind: 'no_note_today', last: quiet.last }]

  return [...missed, ...unsigned, ...open, ...soon, ...note]
}
