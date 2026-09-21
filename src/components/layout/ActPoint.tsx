import type { Answer } from '@/app/session/capabilities'
import { ActLine } from '@/components/primitives'
import styles from './ActPoint.module.css'

/**
 * The PRD's open question about an act, drawn where the act would be.
 *
 * **It used to draw the act as well, unavailable, with the reason beneath it.**
 * That is gone. A control neither this reader nor any reader of this build can
 * press is not drawn at all: an affordance that refuses is a thing to read
 * about somebody else's job, and this product is read by somebody with eight
 * minutes and a resident waiting. Drawing nothing says nothing, which is the
 * truth — the act is not theirs, or it is not built, and either way there is
 * nothing here for them to do.
 *
 * **What survives is the question the PRD leaves open**, because that is not a
 * statement about this build at all. The role table lets this role act and does
 * not say for which residents; the words are the question for the PRD's author,
 * and they stay on the screen where the decision would be made. See
 * `capabilities.ts`.
 *
 * The props the answer does not use are kept so a screen still states the act
 * it is asking about, which is what makes the question legible in review.
 */
export function ActPoint({
  answer,
}: {
  answer: Answer
  /** The act being asked about. */
  label: string
  /** What the line used to say while the act was not built. */
  notBuilt: string
  /** Named where an answer is about one resident. */
  residentName?: string
}) {
  if (answer.kind !== 'not_stated' && answer.kind !== 'contradicted') return null

  return (
    <div className={styles.point} data-answer={answer.kind}>
      <ActLine kind="not_stated">{answer.question}</ActLine>
    </div>
  )
}
