import type { Answer } from '@/app/session/capabilities'
import { noListYetLine, notOnYourListLine } from '@/app/session/resident-scope'
import { assertNever } from '@/lib/assert-never'
import { ActLine, Button } from '@/components/primitives'
import styles from './ActPoint.module.css'

/**
 * An act drawn where it would be performed, with the one line that says what
 * happens when it is tried.
 *
 * **It draws an answer, never a role.** The screen asks the role table and
 * hands the answer here, so which line appears is decided in one place:
 *
 * - `yes`: the control is live and the act is not built, and the line says so.
 * - `not_your_role`: the control is unavailable, with the table's own reason.
 * - `not_on_your_list` and `no_list_yet`: unavailable, said as scope.
 * - `not_stated`: unavailable, with the question the PRD leaves open. The build
 *   does not decide it by drawing the control either way.
 */
export function ActPoint({
  answer,
  label,
  notBuilt,
  residentName,
}: {
  answer: Answer
  label: string
  /** What the line says while the act is not built: "Scoring is not built." */
  notBuilt: string
  /** Needed only to say a resident is not on the viewer's list. */
  residentName?: string
}) {
  return (
    <div className={styles.point} data-answer={answer.kind}>
      <Button variant="secondary" size="small" disabled={answer.kind !== 'yes'}>
        {label}
      </Button>
      <AnswerLine answer={answer} notBuilt={notBuilt} residentName={residentName} />
    </div>
  )
}

function AnswerLine({
  answer,
  notBuilt,
  residentName,
}: {
  answer: Answer
  notBuilt: string
  residentName: string | undefined
}) {
  switch (answer.kind) {
    case 'yes':
      return <ActLine kind="not_built">{notBuilt}</ActLine>
    case 'not_your_role':
      return <ActLine kind="refused">{answer.reason}</ActLine>
    case 'not_on_your_list':
      if (residentName === undefined)
        throw new Error('A resident not on the list was drawn without their name.')
      return <ActLine kind="refused">{notOnYourListLine(residentName)}</ActLine>
    case 'no_list_yet':
      return <ActLine kind="refused">{noListYetLine}</ActLine>
    case 'not_stated':
      return <ActLine kind="not_stated">{answer.question}</ActLine>
    default:
      return assertNever(answer)
  }
}
