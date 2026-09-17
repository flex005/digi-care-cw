import type { IsoDate, MarCellState, Medication } from '@/data/types'
import type { MarRecord } from '@/data/fixtures/medications'
import { assertNever } from '@/lib/assert-never'

/**
 * The shape of a resident's MAR chart for one month, worked out before anything
 * renders it. CW PRD MED-04.
 *
 * Pure: no clock is read here. Every state comes from a record, and the month
 * bounds come from the records too, so the grid a test asserts on is the grid a
 * reader sees.
 *
 * **One cell per medication, day and round**, the Admin build's decision and for
 * its reasons: medications down, days across, each day's rounds beneath it. A
 * cell then holds exactly one `MarCellState`, so a table cell's two headers (the
 * day and the round) name it completely, its accessible name is one sentence
 * about one dose, and a dose with no record is one hatched cell rather than a
 * line of small print inside a cell that also holds two given doses. Rounds
 * nested inside a day cell would make the thing a screen reader announces a
 * list of doses with one name, and the omission the chart exists to show would
 * sit beside its recorded neighbours in the same box.
 *
 * **A missing record is a rendered state, never a missing cell.** Every
 * intersection produces a cell, and where no record exists the cell says why in
 * its own words: no dose of this medicine at that round, not prescribed yet, or
 * no record held. None of them is an omission. An omission is a claim that a
 * dose was due and nobody recorded it, and only the record can make that claim.
 */

/** A calendar month. `month` runs 1 to 12. */
export interface MarMonth {
  year: number
  month: number
}

export interface MarDay {
  date: IsoDate
  /** 'Wed' */
  weekday: string
  /** '16/09' */
  label: string
}

/**
 * What one intersection holds.
 *
 * - `recorded`: the record for this medication, day and round.
 * - `not_on_this_round`: this medicine is not prescribed at this round; another
 *   of the resident's medicines is.
 * - `not_prescribed_yet`: the day is before the prescription started.
 * - `not_held`: the medicine was prescribed at this round and no record of it
 *   is held. Not an omission: see the file's head.
 */
export type MarGridCell =
  | { kind: 'recorded'; state: MarCellState }
  | { kind: 'not_on_this_round' }
  | { kind: 'not_prescribed_yet'; startedOn: IsoDate }
  | { kind: 'not_held' }

export interface MarCellAt {
  medication: Medication
  date: IsoDate
  roundTime: string
  cell: MarGridCell
}

export interface MarRow {
  medication: Medication
  cells: MarCellAt[]
}

export interface MarGrid {
  month: MarMonth
  days: MarDay[]
  /** Every round time any of the resident's medicines uses, in order. */
  rounds: string[]
  rows: MarRow[]
}

/**
 * How far the record held for this resident reaches.
 *
 * `none_held` is a real answer: a resident with nothing on record has no month
 * to show, which is different from a month in which nothing happened.
 */
export type MarHistory =
  | { kind: 'none_held' }
  | { kind: 'held'; firstDate: IsoDate; lastDate: IsoDate; months: MarMonth[] }

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const pad = (value: number) => String(value).padStart(2, '0')

function isoDate(year: number, month: number, day: number): IsoDate {
  return `${year}-${pad(month)}-${pad(day)}` as IsoDate
}

function monthOf(date: IsoDate): MarMonth {
  const [year, month] = date.split('-')
  return { year: Number(year), month: Number(month) }
}

const sameMonth = (a: MarMonth, b: MarMonth) => a.year === b.year && a.month === b.month

/** 'September 2026'. */
export function monthLabel(month: MarMonth): string {
  return `${MONTHS[month.month - 1] ?? ''} ${month.year}`
}

/**
 * The months the record reaches, oldest first: from the month of the earliest
 * record to the month of the latest, and none either side.
 */
export function historyOf(records: MarRecord[]): MarHistory {
  if (records.length === 0) return { kind: 'none_held' }
  const dates = records.map((record) => record.date).sort()
  const firstDate = dates[0]!
  const lastDate = dates[dates.length - 1]!

  const months: MarMonth[] = []
  const last = monthOf(lastDate)
  let cursor = monthOf(firstDate)
  while (
    cursor.year < last.year ||
    (cursor.year === last.year && cursor.month <= last.month)
  ) {
    months.push(cursor)
    cursor =
      cursor.month === 12
        ? { year: cursor.year + 1, month: 1 }
        : { year: cursor.year, month: cursor.month + 1 }
  }
  return { kind: 'held', firstDate, lastDate, months }
}

/**
 * The days of a month the record reaches.
 *
 * **Clipped to the record at both ends.** The first month starts on the first
 * day a record is held and the last stops on the last, so no column stands for
 * a day the record does not cover: a column before the record would be read as
 * a day on which nothing was given, and a column after today as a day already
 * lived.
 */
export function daysShown(
  month: MarMonth,
  history: Extract<MarHistory, { kind: 'held' }>,
): MarDay[] {
  const length = new Date(Date.UTC(month.year, month.month, 0)).getUTCDate()
  const days: MarDay[] = []
  for (let day = 1; day <= length; day += 1) {
    const date = isoDate(month.year, month.month, day)
    if (date < history.firstDate || date > history.lastDate) continue
    const weekday = new Date(Date.UTC(month.year, month.month - 1, day)).getUTCDay()
    days.push({
      date,
      weekday: WEEKDAYS[weekday]!,
      label: `${pad(day)}/${pad(month.month)}`,
    })
  }
  return days
}

/** Builds one month's grid. Pure: every state comes from a record. */
export function buildMarGrid(
  medications: Medication[],
  records: MarRecord[],
  month: MarMonth,
  history: Extract<MarHistory, { kind: 'held' }>,
): MarGrid {
  const days = daysShown(month, history)
  const rounds = [
    ...new Set(medications.flatMap((medication) => medication.roundTimes)),
  ].sort()

  const byKey = new Map<string, MarRecord>()
  for (const record of records) {
    if (!sameMonth(monthOf(record.date), month)) continue
    byKey.set(keyOf(record.medicationId, record.date, record.roundTime), record)
  }

  const rows = medications.map((medication): MarRow => {
    const onRound = new Set<string>(medication.roundTimes)
    const cells = days.flatMap((day) =>
      rounds.map((roundTime): MarCellAt => {
        const record = byKey.get(keyOf(medication.id, day.date, roundTime))
        const at = { medication, date: day.date, roundTime }
        if (record !== undefined)
          return { ...at, cell: { kind: 'recorded', state: record.state } }
        if (day.date < medication.startedOn)
          return {
            ...at,
            cell: { kind: 'not_prescribed_yet', startedOn: medication.startedOn },
          }
        if (!onRound.has(roundTime))
          return { ...at, cell: { kind: 'not_on_this_round' } }
        return { ...at, cell: { kind: 'not_held' } }
      }),
    )
    return { medication, cells }
  })

  return { month, days, rounds, rows }
}

export const keyOf = (medicationId: string, date: string, roundTime: string) =>
  `${medicationId}|${date}|${roundTime}`

/**
 * How a cell looks, apart from what it says.
 *
 * The legend draws these without inventing a record, and the grid derives one
 * from each cell, so the two cannot drift. `prn` and `secondSignature` are
 * separate facts on a given dose, never a merged state: a PRN dose is a
 * recorded dose, and a missing second signature is a second mark beside
 * "Given", not a different kind of given.
 */
export type MarCellLook =
  | { kind: 'given'; prn: boolean; secondSignature: 'missing' | 'not_missing' }
  | { kind: 'not_given' }
  | { kind: 'omitted'; closure: 'open' | 'closed' }
  | { kind: 'due' }
  | { kind: 'not_due' }
  | { kind: 'not_prescribed_yet' }
  | { kind: 'not_held' }

export function lookOf(cell: MarGridCell, medication: Medication): MarCellLook {
  switch (cell.kind) {
    case 'not_on_this_round':
      return { kind: 'not_due' }
    case 'not_prescribed_yet':
      return { kind: 'not_prescribed_yet' }
    case 'not_held':
      return { kind: 'not_held' }
    case 'recorded':
      return lookOfState(cell.state, medication)
    default:
      return assertNever(cell)
  }
}

function lookOfState(state: MarCellState, medication: Medication): MarCellLook {
  switch (state.kind) {
    case 'given':
      return {
        kind: 'given',
        prn: medication.isPrn,
        secondSignature:
          state.witness.kind === 'required_not_recorded' ? 'missing' : 'not_missing',
      }
    case 'not_given':
      return { kind: 'not_given' }
    case 'omitted':
      return { kind: 'omitted', closure: state.closure.kind }
    case 'due':
      return { kind: 'due' }
    case 'not_due':
      return { kind: 'not_due' }
    default:
      return assertNever(state)
  }
}

/** The `data-mar` value: one word per look, PRN given apart from given. */
export function lookName(look: MarCellLook): string {
  return look.kind === 'given' && look.prn ? 'prn_given' : look.kind
}
