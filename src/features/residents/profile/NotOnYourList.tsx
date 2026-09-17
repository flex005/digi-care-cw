import type { Answer } from '@/app/session/capabilities'
import { noListYetLine, notOnYourListLine } from '@/app/session/resident-scope'
import type { Resident } from '@/data/types'
import { Card } from '@/components/primitives'
import { assertNever } from '@/lib/assert-never'
import { listName } from '../list-name'
import styles from './profile.module.css'

/**
 * A resident the viewer's list does not reach.
 *
 * **Scope, never blame, and never an implication that the record does not
 * exist.** It names the resident, because the reader typed or followed a link
 * to a real person and a nameless refusal leaves them unable to tell a mistake
 * from a boundary. It shows nothing else of the record.
 *
 * Neither the hatch nor the caution treatment: nothing is missing and nothing
 * is wrong. The record is there and is not on this person's list.
 */
export function NotOnYourList({
  answer,
  resident,
}: {
  answer: Exclude<Answer, { kind: 'yes' }>
  resident: Resident
}) {
  const name = listName(resident)
  return (
    <Card>
      <div className={styles.notOnList} data-not-on-list={answer.kind}>
        <p className={styles.notOnListTitle}>{headline(answer, name)}</p>
        <p className={styles.notOnListBody}>{body(answer)}</p>
      </div>
    </Card>
  )
}

function headline(answer: Exclude<Answer, { kind: 'yes' }>, name: string): string {
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

function body(answer: Exclude<Answer, { kind: 'yes' }>): string {
  switch (answer.kind) {
    case 'not_on_your_list':
      return 'Their record is not shown here because your list does not include them. Your list is set on your staff record.'
    case 'no_list_yet':
      return 'Until somebody gives you a list of residents, no resident’s record opens here.'
    case 'not_your_role':
    case 'not_the_author':
    case 'not_stated':
    case 'contradicted':
      return 'Their record is not shown here.'
    default:
      return assertNever(answer)
  }
}
