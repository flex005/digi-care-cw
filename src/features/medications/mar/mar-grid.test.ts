import { describe, expect, it } from 'vitest'
import type { IsoDate, Medication, ResidentId } from '@/data/types'
import {
  marRecordsFor,
  medicationsFor,
  type MarRecord,
} from '@/data/fixtures/medications'
import { staffEze } from '@/data/fixtures/organisation'
import {
  buildMarGrid,
  daysIn,
  daysShown,
  historyOf,
  lookOf,
  monthLabel,
} from './mar-grid'
import { marCellSentence, type SentenceWords } from './mar-sentence'

/**
 * The grid before it renders: which months it offers, which days it draws, and
 * that every intersection is a cell with its own answer.
 */

const OKAFOR = 'res-okafor' as ResidentId
const records = marRecordsFor(OKAFOR)
const medications = medicationsFor(OKAFOR)

const held = () => {
  const history = historyOf(records)
  if (history.kind !== 'held') throw new Error('Okafor has no record')
  return history
}

const words: SentenceWords = {
  time: (value) => value.slice(11, 16),
  dateTime: (value) => value.slice(0, 16),
  date: (value) => value.split('-').reverse().join('/'),
  staff: (ref) => ref.displayName,
}

describe('the months the record reaches', () => {
  it('runs from the first record’s month to the last, and no further', () => {
    const history = held()
    const dates = records.map((record) => record.date).sort()
    expect(history.firstDate).toBe(dates[0])
    expect(history.lastDate).toBe(dates[dates.length - 1])
    expect(history.months[0]).toEqual({
      year: Number(dates[0]!.slice(0, 4)),
      month: Number(dates[0]!.slice(5, 7)),
    })
    const last = history.months[history.months.length - 1]!
    expect(`${last.year}-${String(last.month).padStart(2, '0')}`).toBe(
      dates[dates.length - 1]!.slice(0, 7),
    )
  })

  it('says a resident with nothing on record has no month, not an empty one', () => {
    expect(historyOf([])).toEqual({ kind: 'none_held' })
  })

  it('draws no day before the record starts or after it ends', () => {
    const history = held()
    const first = daysShown(history.months[0]!, history)
    expect(first[0]?.date).toBe(history.firstDate)
    const last = daysShown(history.months[history.months.length - 1]!, history)
    expect(last[last.length - 1]?.date).toBe(history.lastDate)
  })

  it('names a month the way a person says it', () => {
    expect(monthLabel({ year: 2026, month: 9 })).toBe('September 2026')
  })
})

describe('every intersection is a cell', () => {
  it('gives every medication a cell for every day and every round', () => {
    const history = held()
    const grid = buildMarGrid(
      medications,
      records,
      daysIn(history.lastDate, 'month', history),
    )
    for (const row of grid.rows) {
      expect(row.cells).toHaveLength(grid.days.length * grid.rounds.length)
    }
  })

  it('says why a cell holds no record, and never calls it an omission', () => {
    const history = held()
    const oneRound = medications.find((m) => m.roundTimes.length === 1)!
    const threeRounds = medications.find((m) => m.roundTimes.length === 3)!
    const grid = buildMarGrid(
      [oneRound, threeRounds],
      [],
      daysIn(history.lastDate, 'month', history),
    )
    const kinds = new Set(
      grid.rows.flatMap((row) => row.cells.map((at) => at.cell.kind)),
    )
    expect(kinds.has('not_on_this_round')).toBe(true)
    expect(kinds.has('not_held')).toBe(true)
    for (const row of grid.rows)
      for (const at of row.cells)
        expect(lookOf(at.cell, at.medication).kind).not.toBe('omitted')
  })

  it('marks a day before the prescription started as not started', () => {
    const later: Medication = { ...medications[0]!, startedOn: '2099-01-01' as IsoDate }
    const history = held()
    const grid = buildMarGrid([later], [], daysIn(history.firstDate, 'month', history))
    expect(
      grid.rows[0]!.cells.every((at) => at.cell.kind === 'not_prescribed_yet'),
    ).toBe(true)
  })
})

describe('the look keeps two facts as two', () => {
  it('keeps a PRN dose a given dose, and a missing second signature a separate mark', () => {
    const prn = medications.find((m) => m.isPrn)!
    const cd = medications.find((m) => m.isControlledDrug)!
    const given = {
      kind: 'given' as const,
      givenAt: '2026-09-16T08:04:00+01:00' as const,
      givenBy: staffEze,
    }
    expect(
      lookOf(
        { kind: 'recorded', state: { ...given, witness: { kind: 'not_required' } } },
        prn,
      ),
    ).toEqual({ kind: 'given', prn: true, secondSignature: 'not_missing' })
    expect(
      lookOf(
        {
          kind: 'recorded',
          state: { ...given, witness: { kind: 'required_not_recorded' } },
        },
        cd,
      ),
    ).toEqual({ kind: 'given', prn: false, secondSignature: 'missing' })
  })
})

describe('the sentence', () => {
  it('names the medicine, dose, day and round, then both facts of a half-signed dose', () => {
    const cd = medications.find((m) => m.isControlledDrug)!
    const sentence = marCellSentence(
      {
        medication: cd,
        date: '2026-09-16' as IsoDate,
        roundTime: '08:00',
        cell: {
          kind: 'recorded',
          state: {
            kind: 'given',
            givenAt: '2026-09-16T08:04:00+01:00',
            givenBy: staffEze,
            witness: { kind: 'required_not_recorded' },
          },
        },
      },
      words,
    )
    expect(sentence).toBe(
      `${cd.name} ${cd.dose}, 16/09/2026, 08:00 round: given at 08:04 by N. Eze, second signature not recorded.`,
    )
  })

  it('says a closed omission is still no record', () => {
    const record = records.find(
      (entry): entry is MarRecord =>
        entry.state.kind === 'omitted' && entry.state.closure.kind === 'closed',
    )!
    const medication = medications.find((m) => m.id === record.medicationId)!
    const sentence = marCellSentence(
      {
        medication,
        date: record.date,
        roundTime: record.roundTime,
        cell: { kind: 'recorded', state: record.state },
      },
      words,
    )
    expect(sentence).toMatch(/: no record\. /)
    expect(sentence).toMatch(/Omission closed by .+ The dose still has no record\.$/)
  })
})
