import { formatCount } from '@/lib/format'
import styles from './GapCount.module.css'

/**
 * A card whose subject is a gap, counted: "Not written up, 4 of your 9
 * residents". The hatch is its surface, because what it counts is records
 * nobody has made.
 *
 * **Every part is required.** The figure never stands without what it is out
 * of, and the detail says what is missing and what population it covers: a
 * count of gaps with no scope is a claim nobody can check.
 */
export function GapCount({
  label,
  value,
  of,
  detail,
}: {
  label: string
  value: number
  /** "of your 9 residents". */
  of: string
  /** What is missing, and what it is counted over. */
  detail: string
}) {
  return (
    <section className={styles.card} data-state="unrecorded" data-gap-count>
      <p className={styles.label}>{label}</p>
      <p className={styles.value} data-numeric>
        {formatCount(value)}
      </p>
      <p className={styles.of}>{of}</p>
      <p className={styles.detail}>{detail}</p>
    </section>
  )
}
