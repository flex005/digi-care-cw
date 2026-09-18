import type { ReactNode } from 'react'
import unrecorded from '@/styles/unrecorded.module.css'
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
 *
 * **`gap` gives the card the unrecorded dashed edge**, for the screens whose
 * lead figure is a count of things nobody has recorded — RA-01's 78 risks never
 * assessed, CON-01's 42 consents never sought. It is the hatch's own edge, from
 * the hatch's own file, applied to a figure that means what it means. It is not
 * available for a figure somebody did record, and nothing enforces that but
 * review: a dark card saying "9 past their review date" with this edge would
 * claim a gap where there is a finding.
 */
export function ActionCard({
  kicker,
  figure,
  of,
  footLabel,
  footValue,
  detail,
  action,
  gap = false,
}: {
  kicker: string
  figure: string
  of: string
  footLabel: string
  footValue: string
  /** What the figure consists of, where the reader needs it before acting. */
  detail?: ReactNode
  action: ReactNode
  /** Whether the figure counts records nobody has made. */
  gap?: boolean
}) {
  return (
    <section
      className={gap ? `${styles.card} ${unrecorded.unrecordedEdge}` : styles.card}
      data-action-card
      data-gap-card={gap ? 'true' : undefined}
    >
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
