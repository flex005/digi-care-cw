import type { IsoDate, IsoDateTime } from '@/data/types'
import { assertNever } from '@/lib/assert-never'
import {
  needsAt,
  NOTHING_CHOSEN,
  outstanding,
  type DoseNeed,
  UNANSWERED,
  windowOf,
  doseName,
  type DoseAnswer,
  type RoundDose,
} from '@/features/medications/round/round'
import type { DoseRecord } from '../phone-data'
import type { Drug } from '../phone-chart'

/**
 * One dose at the round, as the phone's dose sheet treats it. **Every scheduled
 * dose at the round is one of these**, so the sheet lists them all and a dose
 * the phone cannot record still says why.
 *
 * - `to_answer`: due, its window open, not a controlled drug: Given or Not given.
 * - `controlled`: due and a controlled drug, which the phone does not record
 *   (module 3, decision 3).
 * - `not_open_yet`: due, its window not open; nobody may record it yet.
 * - `window_closed`: the window closed with nothing recorded, an omission. Not
 *   recordable here: closing an omission is the desktop's (MED-01).
 * - `recorded`: given or not given, by somebody; shown, never answered over.
 */
export type SheetDose =
  | { kind: 'to_answer'; dose: RoundDose }
  | { kind: 'controlled'; dose: RoundDose }
  | { kind: 'not_open_yet'; dose: RoundDose; opensAt: IsoDateTime }
  | { kind: 'window_closed'; dose: RoundDose }
  | { kind: 'recorded'; dose: RoundDose }

/** A person's scheduled doses at one round today, sorted for the sheet. */
export function sheetDoses(input: {
  drugs: Drug[]
  records: DoseRecord[]
  roundTime: string
  date: IsoDate
  at: IsoDateTime
}): SheetDose[] {
  const { drugs, records, roundTime, date, at } = input
  return drugs
    .filter((drug) => !drug.isPrn)
    .flatMap((drug): SheetDose[] => {
      const record = records.find(
        (entry) =>
          entry.medicationId === drug.id &&
          entry.date === date &&
          entry.roundTime === roundTime,
      )
      if (record === undefined || record.state.kind === 'not_due') return []
      const dose: RoundDose = { medication: drug, record }
      const state = record.state
      switch (state.kind) {
        case 'given':
        case 'not_given':
          return [{ kind: 'recorded', dose }]
        case 'omitted':
          return [{ kind: 'window_closed', dose }]
        case 'due':
          break
        default:
          return assertNever(state)
      }
      if (drug.isControlledDrug) return [{ kind: 'controlled', dose }]
      const window = windowOf(state, at)
      switch (window) {
        case 'not_open_yet':
          return [{ kind: 'not_open_yet', dose, opensAt: state.windowOpensAt }]
        case 'closed':
          return [{ kind: 'window_closed', dose }]
        case 'open':
          return [{ kind: 'to_answer', dose }]
        default:
          return assertNever(window)
      }
    })
}

/**
 * What still stands between the sheet and its signature, dose by dose, **asked
 * of the desktop round's `outstanding`**, so a missing reason is said in the
 * same words at the trolley and on the phone, at the dose it is about.
 *
 * Only the doses the sheet offers an answer for are passed: a controlled drug
 * is not on the sheet's answers at all, so it neither blocks the doses that are
 * nor counts as answered.
 */
export function stillNeeded(
  doses: SheetDose[],
  answers: Record<string, DoseAnswer>,
): { needs: DoseNeed[]; ready: boolean; answered: number; asked: number } {
  const asked = doses.flatMap((entry) =>
    entry.kind === 'to_answer' ? [entry.dose] : [],
  )
  const { needs, ready } = outstanding({
    doses: asked,
    answers,
    access: () => ({ window: { kind: 'open' }, record: { kind: 'open' } }),
    balance: () => ({ kind: 'no_balance_recorded' }),
    prn: [],
  })
  const answered = asked.filter(
    (dose) => (answers[dose.medication.id] ?? UNANSWERED).kind !== 'unanswered',
  ).length
  /*
   * `outstanding` names an unanswered dose only once another is chosen, which
   * suits a trolley card already in front of somebody. A sheet opened to record
   * says from the start what it is asking for.
   */
  const unanswered = asked
    .filter((dose) => (answers[dose.medication.id] ?? UNANSWERED).kind === 'unanswered')
    .filter((dose) => needsAt(needs, dose.medication.id).length === 0)
    .map((dose) => ({ medicationId: dose.medication.id, need: NOTHING_CHOSEN }))
  const all = [...unanswered, ...needs]
  return {
    needs: all,
    ready: ready && all.length === 0,
    answered,
    asked: asked.length,
  }
}

/**
 * The open doses at the round the sheet cannot answer, by name, **asked of the
 * record's own list of what a round must answer** (`openDosesAt`): a controlled
 * drug, a dose not open yet, an omission. While any is open the round cannot be
 * signed on the phone, because the record takes a round whole.
 */
export function heldBack(doses: SheetDose[], open: string[]): string[] {
  return doses
    .filter(
      (entry) =>
        entry.kind !== 'to_answer' &&
        entry.kind !== 'recorded' &&
        open.includes(entry.dose.medication.id),
    )
    .map((entry) => doseName(entry.dose.medication))
}
