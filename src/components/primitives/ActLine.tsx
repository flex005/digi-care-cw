import { Icon } from '@/components/icon/Icon'
import { actLineIcons } from './act-line.icons'
import styles from './ActLine.module.css'

/**
 * One short line, at the point of an act, saying what the act does not do.
 *
 * - `refused`: this role cannot do this. The words come from the role table
 *   (`CARE_ACTS`), never from the screen.
 * - `not_built`: the control is drawn and the act is not implemented.
 * - `not_performed`: the act is recorded and its consequence in the world does
 *   not happen, because this build has no server, no email and no pushes.
 * - `not_stated`: the PRD lets this role act and does not say for whom. The
 *   words are the question for review, from the role table, and the control
 *   stays unavailable rather than guessing either way.
 *
 * **One line, never a paragraph**, and never behind a click: a statement
 * somebody has to open is a statement somebody does not read, and the
 * `not_performed` kind is the one that matters most. A reader who believes a
 * manager was told may not telephone the manager.
 */
export type ActLineKind = 'refused' | 'not_built' | 'not_performed' | 'not_stated'

export function ActLine({ kind, children }: { kind: ActLineKind; children: string }) {
  return (
    <p className={styles.line} data-act-line={kind}>
      <Icon name={actLineIcons.note} size={16} />
      <span>{children}</span>
    </p>
  )
}
