import { describe, expect, it } from 'vitest'
import type { IsoDate, IsoDateTime, Medication, StockBalance } from '@/data/types'
import { NEWLY_PRESCRIBED_CD, medications } from '@/data/fixtures/medications'
import { staffAkinyemi, staffOsei } from '@/data/fixtures/organisation'
import {
  UNANSWERED,
  outstanding,
  signsLine,
  windowFor,
  type DoseAccess,
  type DoseAnswer,
  type RoundDose,
} from './round'

/**
 * The round's rules, as arithmetic. CW PRD MED-02.
 *
 * **The opening count lives here rather than on the screen.** A dose can only
 * be answered inside its window, and inside every window the fixtures have
 * already signed for the one drug the register has never counted, so the
 * screen cannot reach it — `round.test.tsx` pins that. The rule it exercises is
 * this one, and it is testable without an hour.
 */

const OPENS = '2026-09-17T19:00:00.000Z' as IsoDateTime
const CLOSES = '2026-09-17T20:00:00.000Z' as IsoDateTime
const BEFORE = '2026-09-17T18:30:00.000Z' as IsoDateTime
const INSIDE = '2026-09-17T19:20:00.000Z' as IsoDateTime
const AFTER = '2026-09-17T20:30:00.000Z' as IsoDateTime

const drug = (id: string): Medication => {
  const found = medications.find((entry) => entry.id === id)
  if (found === undefined) throw new Error(`No medication ${id}`)
  return found
}

const neverCounted = drug(NEWLY_PRESCRIBED_CD)
const ordinary = medications.find(
  (entry) =>
    !entry.isControlledDrug && !entry.isPrn && entry.roundTimes.includes('20:00'),
)
if (ordinary === undefined) throw new Error('No ordinary 20:00 drug in the fixtures')

const dueDose = (medication: Medication): RoundDose => ({
  medication,
  record: {
    medicationId: medication.id,
    residentId: medication.residentId,
    roundTime: '20:00',
    date: '2026-09-17' as IsoDate,
    state: { kind: 'due', windowOpensAt: OPENS, windowClosesAt: CLOSES },
  },
})

const noBalance: StockBalance = { kind: 'no_balance_recorded' }
const open: DoseAccess = { window: { kind: 'open' }, record: { kind: 'open' } }

describe('the window', () => {
  it('is shut before it opens, open inside it, and open again after it closes', () => {
    const dose = dueDose(ordinary)
    expect(windowFor(dose, BEFORE)).toEqual({ kind: 'not_open_yet', opensAt: OPENS })
    expect(windowFor(dose, INSIDE)).toEqual({ kind: 'open' })
    // A dose given at 20:40 is recorded at 20:40. Late is not early.
    expect(windowFor(dose, AFTER)).toEqual({ kind: 'open' })
  })

  it('leaves a dose already on the record alone', () => {
    const dose = dueDose(ordinary)
    const recorded: RoundDose = {
      ...dose,
      record: {
        ...dose.record,
        state: {
          kind: 'given',
          givenAt: INSIDE,
          givenBy: staffAkinyemi,
          witness: { kind: 'not_required' },
        },
      },
    }
    expect(windowFor(recorded, BEFORE)).toEqual({ kind: 'open' })
  })
})

describe('a round whose window has not opened', () => {
  const shut: DoseAccess = {
    window: { kind: 'not_open_yet', opensAt: OPENS },
    record: { kind: 'open' },
  }

  it('is named as not open yet, waits on nobody, and cannot be recorded', () => {
    const result = outstanding({
      doses: [dueDose(ordinary)],
      answers: {},
      access: () => shut,
      balance: () => noBalance,
      prn: [],
    })
    expect(result.notOpenYet.map((dose) => dose.medication.id)).toEqual([ordinary.id])
    expect(result.waiting).toEqual([])
    expect(result.blocked).toEqual([])
    expect(result.ready).toBe(false)
  })

  it('still records an as-required dose, which is not due at a round at all', () => {
    const prn = medications.find((entry) => entry.isPrn)
    if (prn === undefined) throw new Error('No PRN in the fixtures')
    const result = outstanding({
      doses: [dueDose(ordinary)],
      answers: {},
      access: () => shut,
      balance: () => noBalance,
      prn: [
        { medication: prn, answer: { kind: 'prn', reason: 'Asked', symptom: 'pain' } },
      ],
    })
    expect(result.ready).toBe(true)
  })
})

describe('the opening count', () => {
  const given: DoseAnswer = { kind: 'given', openingCount: '', witness: 'not_chosen' }
  const ask = (answer: DoseAnswer) =>
    outstanding({
      doses: [dueDose(neverCounted)],
      answers: { [neverCounted.id]: answer },
      access: () => open,
      balance: () => noBalance,
      prn: [],
    })

  it('names the count and the witness while either is missing', () => {
    expect(ask(given).waiting).toEqual([
      `${neverCounted.name}: no opening count`,
      `${neverCounted.name}: no witness to the opening count`,
    ])
    expect(ask(given).ready).toBe(false)
    expect(ask({ ...given, openingCount: '40' }).waiting).toEqual([
      `${neverCounted.name}: no witness to the opening count`,
    ])
    expect(ask({ ...given, witness: staffOsei.id }).waiting).toEqual([
      `${neverCounted.name}: no opening count`,
    ])
  })

  it('is ready once both are there, and the PIN says what it signs', () => {
    const answer: DoseAnswer = {
      kind: 'given',
      openingCount: '40',
      witness: staffOsei.id,
    }
    expect(ask(answer).ready).toBe(true)
    expect(
      signsLine([{ medication: neverCounted, answer }], [], () => staffOsei.fullName),
    ).toBe(
      `Given: ${neverCounted.name} ${neverCounted.dose}, controlled drug, second signature to follow on the register; ` +
        `Opening balance: 40 ${neverCounted.stockUnit} of ${neverCounted.name}, witnessed by ${staffOsei.fullName}`,
    )
  })

  it('is not asked for where a balance has been counted', () => {
    const counted: StockBalance = {
      kind: 'counted',
      value: 40,
      countedAt: INSIDE,
      countedBy: staffAkinyemi,
    }
    const result = outstanding({
      doses: [dueDose(neverCounted)],
      answers: { [neverCounted.id]: given },
      access: () => open,
      balance: () => counted,
      prn: [],
    })
    expect(result.waiting).toEqual([])
    expect(result.ready).toBe(true)
  })
})

describe('an unanswered dose inside an open window', () => {
  it('is named once somebody has started the round, and not before', () => {
    const doses = [dueDose(ordinary), dueDose(neverCounted)]
    const quiet = outstanding({
      doses,
      answers: {},
      access: () => open,
      balance: () => noBalance,
      prn: [],
    })
    expect(quiet.waiting).toEqual([])
    expect(quiet.notOpenYet).toEqual([])

    const started = outstanding({
      doses,
      answers: {
        [ordinary.id]: { kind: 'given', openingCount: '', witness: 'not_chosen' },
      },
      access: () => open,
      balance: () => ({
        kind: 'counted',
        value: 10,
        countedAt: INSIDE,
        countedBy: staffAkinyemi,
      }),
      prn: [],
    })
    expect(started.waiting).toEqual([`${neverCounted.name}: nothing chosen`])
    expect(UNANSWERED.kind).toBe('unanswered')
  })
})
