import type { IsoDate, IsoDateTime, MarWitness, StaffRef } from '@/data/types'
import { assertNever } from '@/lib/assert-never'
import { NOT_GIVEN_REASON_LABEL } from '../medication-words'
import type { MarCellAt } from './mar-grid'

/**
 * The full sentence a MAR cell is announced by. CLAUDE.md §7: "full-sentence
 * accessible names per cell".
 *
 * "Morphine sulfate oral solution 2.5ml, 16/09/2026, 08:00 round: given at
 * 08:04 by C. Nwosu, second signature not recorded."
 *
 * **Whole on its own.** A screen reader moving cell by cell hears no row or
 * column header unless it asks, so each sentence names the medicine, the dose,
 * the day and the round before it says what happened. Given with its second
 * signature missing says both, in one sentence and as two clauses: the dose,
 * then the gap.
 *
 * The formatting is passed in, so the sentence renders times in the resident's
 * home's zone through the same formatter as every other clinical time.
 */
export interface SentenceWords {
  time: (value: IsoDateTime) => string
  dateTime: (value: IsoDateTime) => string
  date: (value: IsoDate) => string
  staff: (ref: StaffRef) => string
}

export function marCellSentence(at: MarCellAt, words: SentenceWords): string {
  const { medication, date, roundTime, cell } = at
  const context = `${medication.name} ${medication.dose}, ${words.date(date)}, ${roundTime} round`

  switch (cell.kind) {
    case 'not_on_this_round':
      return `${context}: not due, no dose of this medicine is prescribed at this round.`
    case 'not_prescribed_yet':
      return `${context}: not due, not prescribed until ${words.date(cell.startedOn)}.`
    case 'not_held':
      return `${context}: no record of this round is held here.`
    case 'recorded':
      break
    default:
      return assertNever(cell)
  }

  const state = cell.state
  switch (state.kind) {
    case 'not_due':
      return `${context}: not due.`
    case 'due':
      return `${context}: due, window open from ${words.time(state.windowOpensAt)} until ${words.time(state.windowClosesAt)}, nothing recorded yet.`
    case 'given':
      return `${context}: ${medication.isPrn ? 'given as required (PRN)' : 'given'} at ${words.time(state.givenAt)} by ${words.staff(state.givenBy)}${witnessClause(state.witness, words)}.`
    case 'not_given':
      return `${context}: not given, ${NOT_GIVEN_REASON_LABEL[state.reason].toLowerCase()}, recorded at ${words.time(state.recordedAt)} by ${words.staff(state.recordedBy)}.${state.note === '' ? '' : ` Note: ${state.note}`}`
    case 'omitted': {
      const escalation =
        state.escalation.kind === 'escalated'
          ? ` Escalated at ${words.time(state.escalation.at)}.`
          : ' Not escalated.'
      const closure =
        state.closure.kind === 'closed'
          ? ` Omission closed by ${words.staff(state.closure.by)}, ${words.dateTime(state.closure.at)}: ${state.closure.reason} The dose still has no record.`
          : ' Not closed.'
      return `${context}: no record. The window for the dose due at ${words.time(state.dueAt)} closed with nothing recorded.${escalation}${closure}`
    }
    default:
      return assertNever(state)
  }
}

function witnessClause(witness: MarWitness, words: SentenceWords): string {
  switch (witness.kind) {
    case 'not_required':
      return ''
    case 'witnessed':
      return `, second signature by ${words.staff(witness.by)}`
    case 'required_not_recorded':
      return ', second signature not recorded'
    default:
      return assertNever(witness)
  }
}
