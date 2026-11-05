import type { Answer } from '@/app/session/capabilities'
import { assertNever } from '@/lib/assert-never'
import { noListYetLine, notOnYourListLine } from './resident-scope'

/**
 * The words for an act the role table refuses, at the point of the act.
 *
 * **One owner, for the desktop and the phone**, so a record refused, a composer
 * refused and a resident refused in the phone's picker say the same thing
 * about the same refusal and cannot drift. Before this, `NotOnYourList` and the
 * phone each held their own copy of this switch. The scope lines come from
 * `resident-scope.ts`; the rest are the role table's own words.
 */
export function refusalOf(
  answer: Exclude<Answer, { kind: 'yes' }>,
  name: string,
): string {
  switch (answer.kind) {
    case 'not_on_your_list':
      return notOnYourListLine(name)
    case 'no_list_yet':
      return noListYetLine
    case 'not_your_role':
    case 'not_the_author':
      return answer.reason
    case 'not_stated':
    case 'contradicted':
      return answer.question
    default:
      return assertNever(answer)
  }
}
