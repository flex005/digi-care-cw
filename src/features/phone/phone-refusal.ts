import type { Answer } from '@/app/session/capabilities'
import { refusalOf } from '@/app/session/refusal'
import { notOnYourListLine } from '@/app/session/resident-scope'

/**
 * The phone's words for an act the reader cannot take, **in the reader's terms**.
 *
 * A screen states what cannot be done in the reader's terms, and the project's
 * open questions live in PROGRESS.md and docs/DEPARTURES.md, never on a screen
 * (CLAUDE.md §6). The desktop still prints the question at the act through the
 * shared `refusalOf` and `ActPoint`; that is the non-conforming surface, tracked
 * in PROGRESS.md for after module 3, and this owner is the phone's until both
 * read from one.
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
