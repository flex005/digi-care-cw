import type { Answer } from '@/app/session/capabilities'
import { refusalOf } from '@/app/session/refusal'
import { notOnYourListLine } from '@/app/session/resident-scope'

/**
 * The phone's words for an act the reader cannot take, **in the reader's terms**.
 *
 * The role table's open questions are for the PRD's author, never for a care
 * worker with a resident waiting. Where the desktop prints the question at the
 * act (CLAUDE.md §6, `not_stated`), the phone says what is true for the reader
 * and nothing about the PRD: the question lives in PROGRESS.md and
 * docs/DEPARTURES.md, phone.
 *
 * - `not_stated` is only ever a person beyond the reader's list, so it says
 *   that: the same line as a person the table keeps to the list.
 * - `contradicted` is the reader not being able to do this on the phone.
 *
 * Every other answer is the shared owner's.
 */
export function phoneRefusalOf(
  answer: Exclude<Answer, { kind: 'yes' }>,
  name: string,
): string {
  switch (answer.kind) {
    case 'not_stated':
      return notOnYourListLine(name)
    case 'contradicted':
      return NOT_ON_THE_PHONE
    default:
      return refusalOf(answer, name)
  }
}

export const NOT_ON_THE_PHONE = 'You cannot do this on the phone.'
