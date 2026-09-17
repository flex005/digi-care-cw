import type { ReactNode } from 'react'
import styles from './ActionCard.module.css'

/**
 * The one dark card on a screen: the thing the reader acts on next, in the
 * brand colour, with the largest figure on the screen.
 *
 * **One per screen.** A second dark card would make the brand colour mean
 * "important" rather than "this is what you do next", and the reader would
 * have to choose between them. Nothing enforces the count; review does.
 *
 * The figure still carries what it is out of (`of`), because the rule that no
 * figure stands alone does not relax for the largest one.
 */
export function ActionCard({
  kicker,
  figure,
  of,
  footLabel,
  footValue,
  detail,
  action,
}: {
  kicker: string
  figure: string
  of: string
  footLabel: string
  footValue: string
  /** What the figure consists of, where the reader needs it before acting. */
  detail?: ReactNode
  action: ReactNode
}) {
  return (
    <section className={styles.card} data-action-card>
      <p className={styles.kicker}>{kicker}</p>
      <p className={styles.figure} data-numeric>
        {figure}
      </p>
      <p className={styles.of}>{of}</p>
      {detail === undefined ? null : <div className={styles.detail}>{detail}</div>}
      <div className={styles.foot}>
        <span>{footLabel}</span>
        <b className={styles.footValue}>{footValue}</b>
      </div>
      <div className={styles.action}>{action}</div>
    </section>
  )
}
