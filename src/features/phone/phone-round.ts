import type { getRound } from '@/data/access/client'
import type { IsoDate, IsoDateTime } from '@/data/types'
import { zonedDate, zonedWallClock, type TimeZone } from '@/lib/format'
import {
  arrivalRound,
  isRecorded,
  residentsAt,
  roundTimesOf,
  windowFor,
} from '@/features/medications/round/round'
import { VOCABULARY } from '@/lib/vocabulary-choice'
import type { Person } from './phone-data'

/**
 * Said under Your round where the reader's list leaves people out. **In the
 * reader's terms**: the desktop round's line adds that the PRD does not say
 * whether they record those doses, which is a question for the PRD's author and
 * not something a care worker can act on (`phone-refusal.ts`).
 */
export const offListLine = `${VOCABULARY.subject.Many} not on your list are not shown.`

/**
 * One person's doses at the round, sorted into what the phone can do about
 * each. **Every dose falls in exactly one bucket**, so the buckets add up to
 * `doses` and nothing at the round goes uncounted.
 *
 * - `recorded`: given or not given, by somebody.
 * - `toRecord`: open now, and not a controlled drug, so the phone can take it.
 * - `notOpenYet`: due, its window not yet open; not a controlled drug.
 * - `controlled`: due, and a controlled drug, which the phone does not record
 *   (module 3, decision 3). **Counted, never dropped**: a person whose only open
 *   doses are controlled drugs is still on the round, and says why nothing can
 *   be recorded for them here.
 * - `windowClosed`: the window closed with nothing recorded, an omission.
 */
export interface RoundRow {
  person: Person
  doses: number
  recorded: number
  toRecord: number
  notOpenYet: { kind: 'none' } | { kind: 'some'; count: number; opensAt: IsoDateTime }
  controlled: number
  windowClosed: number
}

/** The round's read, as `getRound` returns it. */
export type RoundData = Awaited<ReturnType<typeof getRound>>

export interface YourRound {
  roundTime: string
  date: IsoDate
  rows: RoundRow[]
  /** People in scope with no scheduled dose at this round, said rather than left out. */
  withoutDose: number
}

/**
 * The round the reader is standing in front of, over the people they record
 * for, asked of the desktop round's own owners: the round from `arrivalRound`,
 * the doses at it from `residentsAt`, each window from `windowFor`. A second
 * copy of any of them would be a phone that disagrees with the trolley.
 */
export function yourRound(input: {
  data: RoundData
  people: Person[]
  at: IsoDateTime
  timeZone: TimeZone
}): YourRound {
  const { data, people, at, timeZone } = input
  const { records } = data
  const drugs = data.medications
  const date = zonedDate(at, timeZone)
  const wall = new Date(zonedWallClock(at, timeZone))
  const roundTime = arrivalRound(
    roundTimesOf(drugs),
    records,
    date,
    at,
    wall.getUTCHours() * 60 + wall.getUTCMinutes(),
  )
  const entries = residentsAt(people, drugs, records, roundTime, date)

  const rows = entries.map((entry): RoundRow => {
    let recorded = 0
    let toRecord = 0
    let controlled = 0
    let windowClosed = 0
    const shut: IsoDateTime[] = []
    for (const dose of entry.doses) {
      const state = dose.record.state
      if (isRecorded(state)) recorded += 1
      else if (state.kind === 'omitted') windowClosed += 1
      else if (dose.medication.isControlledDrug) controlled += 1
      else {
        const window = windowFor(dose, at)
        if (window.kind === 'not_open_yet') shut.push(window.opensAt)
        else toRecord += 1
      }
    }
    const [opensAt] = shut.sort()
    return {
      person: entry.resident,
      doses: entry.doses.length,
      recorded,
      toRecord,
      notOpenYet:
        opensAt === undefined
          ? { kind: 'none' }
          : { kind: 'some', count: shut.length, opensAt },
      controlled,
      windowClosed,
    }
  })

  return { roundTime, date, rows, withoutDose: people.length - rows.length }
}
