import type {
  IsoDate,
  IsoDateTime,
  MarCellState,
  Medication,
  NotGivenReason,
  Resident,
  StaffRef,
  StockBalance,
} from '@/data/types'
import type { MarRecord } from '@/data/fixtures/medications'
import { minutesOfDay } from '@/data/fixtures/rounds'
import { NOT_GIVEN_REASON_LABEL } from '../medication-words'

/**
 * A medication round, worked out before anything renders it. CW PRD MED-02.
 *
 * Pure, and every instant is passed in, so the round a test asserts on is the
 * round a carer sees, whatever the hour the suite runs.
 *
 * **Room order**, the order the trolley goes down the corridor. A resident whose
 * room is unrecorded sorts last rather than being dropped: absence from a list
 * is the same bug as a blank cell.
 */

/** A scheduled dose at this round, with what the chart holds for it. */
export interface RoundDose {
  medication: Medication
  record: MarRecord
}

export interface RoundResident {
  resident: Resident
  /** Scheduled doses at this round, never a PRN and never a `not_due` cell. */
  doses: RoundDose[]
  /**
   * The resident's as-required medications.
   *
   * **Never in `doses`.** A PRN is not due at a round; it is available. In the
   * due list, leaving it unanswered would read as a dose somebody missed.
   */
  asRequired: Medication[]
}

/** Given or not given: somebody recorded a decision. Due and omitted are not. */
export function isRecorded(state: MarCellState): boolean {
  return state.kind === 'given' || state.kind === 'not_given'
}

/** The home's round times, from the prescriptions, never a list typed here. */
export function roundTimesOf(medications: Medication[]): string[] {
  return [...new Set(medications.flatMap((medication) => medication.roundTimes))].sort()
}

function roomOrder(resident: Resident): [number, string] {
  if (resident.room.kind !== 'recorded') return [Number.MAX_SAFE_INTEGER, '']
  const value = resident.room.value
  const digits = Number.parseInt(value, 10)
  return [Number.isNaN(digits) ? Number.MAX_SAFE_INTEGER : digits, value]
}

/** Every resident with a scheduled dose at this round, on this date, in room order. */
export function residentsAt(
  residents: Resident[],
  medications: Medication[],
  records: MarRecord[],
  roundTime: string,
  date: IsoDate,
): RoundResident[] {
  const cell = new Map<string, MarRecord>()
  for (const record of records) {
    cell.set(`${record.medicationId}|${record.date}|${record.roundTime}`, record)
  }

  return residents
    .map((resident) => {
      const theirs = medications.filter((entry) => entry.residentId === resident.id)
      const doses: RoundDose[] = []
      for (const medication of theirs) {
        if (medication.isPrn || !medication.roundTimes.includes(roundTime)) continue
        const record = cell.get(`${medication.id}|${date}|${roundTime}`)
        // A drug changed every third day has a `not_due` cell on the days
        // between. It is not a dose waiting for an answer.
        if (record === undefined || record.state.kind === 'not_due') continue
        doses.push({ medication, record })
      }
      return {
        resident,
        doses,
        asRequired: theirs.filter((medication) => medication.isPrn),
      }
    })
    .filter((entry) => entry.doses.length > 0)
    .sort((a, b) => {
      const [an, av] = roomOrder(a.resident)
      const [bn, bv] = roomOrder(b.resident)
      return an === bn ? av.localeCompare(bv) : an - bn
    })
}

/** How many doses a round holds and how many are on the record. */
export function roundCount(entries: RoundResident[]): {
  due: number
  recorded: number
} {
  const doses = entries.flatMap((entry) => entry.doses)
  return {
    due: doses.length,
    recorded: doses.filter((dose) => isRecorded(dose.record.state)).length,
  }
}

/**
 * The round somebody arriving now is standing in front of.
 *
 * The round whose window is open, read from the chart's own windows; failing
 * that, the round time nearest the home's wall clock.
 */
export function arrivalRound(
  roundTimes: string[],
  records: MarRecord[],
  date: IsoDate,
  now: IsoDateTime,
  wallMinutes: number,
): string {
  const at = new Date(now).getTime()
  const open = roundTimes.find((roundTime) =>
    records.some(
      (record) =>
        record.date === date &&
        record.roundTime === roundTime &&
        record.state.kind === 'due' &&
        new Date(record.state.windowOpensAt).getTime() <= at &&
        at < new Date(record.state.windowClosesAt).getTime(),
    ),
  )
  if (open !== undefined) return open
  const distance = (roundTime: string) =>
    Math.abs(minutesOfDay(roundTime) - wallMinutes)
  const [nearest] = [...roundTimes].sort((a, b) => distance(a) - distance(b))
  if (nearest === undefined) throw new Error('A home with no round times has no round.')
  return nearest
}

/**
 * Whether a due dose's window has opened.
 *
 * **Before it opens, nothing about the dose can be recorded.** Giving a drug
 * early is a clinical decision, and nothing in this product can make one, so
 * the answer is not offered and the time it opens is said instead. Recording it
 * *late* stays open: a dose given at 20:40 is recorded at 20:40, and a window
 * that closes with nothing in it is an omission, which is a different screen.
 */
export function windowOf(
  state: Extract<MarCellState, { kind: 'due' }>,
  now: IsoDateTime,
): 'open' | 'not_open_yet' | 'closed' {
  const at = new Date(now).getTime()
  if (at < new Date(state.windowOpensAt).getTime()) return 'not_open_yet'
  if (at >= new Date(state.windowClosesAt).getTime()) return 'closed'
  return 'open'
}

/**
 * The window a dose is in, in the shape the card and the row both answer with.
 *
 * A dose already on the record has no window left to open: it was answered.
 */
export function windowFor(dose: RoundDose, now: IsoDateTime): DoseWindow {
  const state = dose.record.state
  if (state.kind !== 'due') return { kind: 'open' }
  return windowOf(state, now) === 'not_open_yet'
    ? { kind: 'not_open_yet', opensAt: state.windowOpensAt }
    : { kind: 'open' }
}

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------

/**
 * The answer chosen on the card for one scheduled dose, before it is recorded.
 *
 * A closed union with `unanswered` in it: a dose nobody has answered is not a
 * dose that was withheld, and there is no default that could turn one into the
 * other.
 */
export type DoseAnswer =
  | { kind: 'unanswered' }
  | {
      kind: 'given'
      /** What was counted in the cabinet, where the register holds no balance. */
      openingCount: string
      /** A staff id, where an opening count needs a witness. */
      witness: string | 'not_chosen'
    }
  | { kind: 'not_given'; reason: NotGivenReason | 'not_chosen'; note: string }

/** A PRN dose being given, before it is recorded. */
export type PrnAnswer =
  { kind: 'not_chosen' } | { kind: 'prn'; reason: string; symptom: string }

export const UNANSWERED: DoseAnswer = { kind: 'unanswered' }
export const PRN_NOT_CHOSEN: PrnAnswer = { kind: 'not_chosen' }

/**
 * The dose's own window. Nothing about a dose is recordable before it opens.
 *
 * **Its own field, beside what the role table and the register say**, because
 * they are different facts about one dose and can be true at once: a care
 * worker at a controlled drug half an hour before the round is stopped by the
 * clock *and* by the contradiction in the role table, and a compound state
 * renders as separate facts (CLAUDE.md §1).
 */
export type DoseWindow =
  { kind: 'open' } | { kind: 'not_open_yet'; opensAt: IsoDateTime }

/** What the register and the role table say about recording this dose. */
export type DoseRecordAccess =
  /** Given and Not given are both open. */
  | { kind: 'open' }
  /**
   * The count does not reconcile, so it cannot be given. Not given stays open:
   * it is not an administration.
   */
  | { kind: 'discrepancy' }
  /** The role table does not let this viewer record it. The dose stays open. */
  | { kind: 'cannot_record' }

/** Whether the viewer can record this dose at all, and whether it can be given. */
export interface DoseAccess {
  window: DoseWindow
  record: DoseRecordAccess
}

/** An opening count is asked for where a controlled drug is given against no balance. */
export function needsOpeningCount(
  medication: Medication,
  balance: StockBalance,
  answer: DoseAnswer,
): boolean {
  return (
    medication.isControlledDrug &&
    answer.kind === 'given' &&
    balance.kind === 'no_balance_recorded'
  )
}

const WHOLE_NUMBER = /^\d+$/

/**
 * What stands between a card and its record, named dose by dose.
 *
 * **Named, not counted.** "Morphine sulfate oral solution: no reason" tells
 * somebody standing at a trolley where to look.
 *
 * **A dose whose window has not opened is not waiting on anybody.** It is not
 * outstanding, it does not block the round, and it is never named here: the
 * only thing standing between it and a record is the hour, which the dose says
 * for itself.
 */
export function outstanding(input: {
  doses: RoundDose[]
  answers: Record<string, DoseAnswer>
  access: (dose: RoundDose) => DoseAccess
  balance: (medication: Medication) => StockBalance
  prn: { medication: Medication; answer: PrnAnswer }[]
}): {
  waiting: string[]
  /** A dose this viewer cannot record, so the round itself cannot be recorded. */
  blocked: RoundDose[]
  /** Doses nobody can record yet, because the round has not opened. */
  notOpenYet: RoundDose[]
  ready: boolean
} {
  const due = input.doses.filter((dose) => dose.record.state.kind === 'due')
  const notOpenYet = due.filter(
    (dose) => input.access(dose).window.kind === 'not_open_yet',
  )
  const open = due.filter((dose) => input.access(dose).window.kind === 'open')
  const answerOf = (dose: RoundDose) => input.answers[dose.medication.id] ?? UNANSWERED
  const blocked = open.filter(
    (dose) => input.access(dose).record.kind === 'cannot_record',
  )
  const chosen = open.filter((dose) => answerOf(dose).kind !== 'unanswered')
  const prnChosen = input.prn.filter((entry) => entry.answer.kind === 'prn')

  const waiting: string[] = []
  for (const dose of open) {
    const answer = answerOf(dose)
    const name = dose.medication.name
    switch (answer.kind) {
      case 'unanswered':
        // Only a shortfall once somebody has started the round: a PRN on its
        // own does not need the round answered.
        if (chosen.length > 0 && input.access(dose).record.kind !== 'cannot_record')
          waiting.push(`${name}: nothing chosen`)
        break
      case 'not_given':
        if (answer.reason === 'not_chosen') waiting.push(`${name}: no reason chosen`)
        else if (answer.reason === 'other' && answer.note.trim() === '')
          waiting.push(`${name}: say why it was not given`)
        break
      case 'given':
        if (
          needsOpeningCount(dose.medication, input.balance(dose.medication), answer)
        ) {
          if (!WHOLE_NUMBER.test(answer.openingCount.trim()))
            waiting.push(`${name}: no opening count`)
          if (answer.witness === 'not_chosen')
            waiting.push(`${name}: no witness to the opening count`)
        }
        break
    }
  }
  for (const entry of prnChosen) {
    if (entry.answer.kind !== 'prn') continue
    if (entry.answer.reason.trim() === '')
      waiting.push(`${entry.medication.name}: no reason for giving it`)
    if (entry.answer.symptom.trim() === '')
      waiting.push(`${entry.medication.name}: no symptom`)
  }

  const roundReady = chosen.length > 0 && blocked.length === 0
  const ready =
    waiting.length === 0 && (chosen.length > 0 ? roundReady : prnChosen.length > 0)
  return { waiting, blocked, notOpenYet, ready }
}

/** The state a chosen answer becomes, signed by the viewer at the moment of the act. */
export function stateFor(
  answer: DoseAnswer,
  medication: Medication,
  by: StaffRef,
  at: IsoDateTime,
): MarCellState {
  switch (answer.kind) {
    case 'given':
      return {
        kind: 'given',
        givenAt: at,
        givenBy: by,
        // Half a record on a controlled drug, until Witness 2 countersigns on
        // the register. Never "not required", which would say nobody need.
        witness: medication.isControlledDrug
          ? { kind: 'required_not_recorded' }
          : { kind: 'not_required' },
      }
    case 'not_given':
      if (answer.reason === 'not_chosen')
        throw new Error(`${medication.name} was recorded as not given with no reason.`)
      return {
        kind: 'not_given',
        reason: answer.reason,
        note: answer.note.trim(),
        recordedAt: at,
        recordedBy: by,
      }
    case 'unanswered':
      throw new Error(`${medication.name} was recorded with no answer.`)
  }
}

/** "Morphine sulfate oral solution 2.5mg". */
export const doseName = (medication: Medication): string =>
  `${medication.name} ${medication.dose}`

/**
 * What the medication PIN signs, in words, dose by dose.
 *
 * "Given: Morphine sulfate oral solution 2.5mg; Not given: Amlodipine 5mg,
 * Resident refused". A PIN that did not say what it confirmed is a signature on
 * a blank page.
 */
export function signsLine(
  answered: { medication: Medication; answer: DoseAnswer }[],
  prn: { medication: Medication; answer: PrnAnswer }[],
  witnessName: (id: string) => string,
): string {
  const parts: string[] = []
  for (const { medication, answer } of answered) {
    switch (answer.kind) {
      case 'given':
        parts.push(
          medication.isControlledDrug
            ? `Given: ${doseName(medication)}, controlled drug, second signature to follow on the register`
            : `Given: ${doseName(medication)}`,
        )
        if (
          WHOLE_NUMBER.test(answer.openingCount.trim()) &&
          answer.witness !== 'not_chosen'
        )
          parts.push(
            `Opening balance: ${answer.openingCount.trim()} ${medication.stockUnit} of ${medication.name}, witnessed by ${witnessName(answer.witness)}`,
          )
        break
      case 'not_given':
        if (answer.reason === 'not_chosen') break
        parts.push(
          answer.reason === 'other'
            ? `Not given: ${doseName(medication)}, ${answer.note.trim()}`
            : `Not given: ${doseName(medication)}, ${NOT_GIVEN_REASON_LABEL[answer.reason]}`,
        )
        break
      case 'unanswered':
        break
    }
  }
  for (const { medication, answer } of prn) {
    if (answer.kind !== 'prn') continue
    parts.push(
      `PRN: ${doseName(medication)}, for ${answer.symptom.trim()}, ${answer.reason.trim()}`,
    )
  }
  return parts.join('; ')
}
