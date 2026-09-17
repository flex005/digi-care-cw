import { PLACEHOLDER_NOTICE } from './instrument'
import styles from './PlaceholderBanner.module.css'

/**
 * On every screen that shows a level this instrument produced.
 *
 * **A figure that does not do what it appears to must say so where it
 * appears.** A note in a release document is not where somebody reads a score,
 * and a care worker reading "High" on a resident's record is reading a score.
 *
 * **Not the hatch.** The Admin build drew this in the unrecorded treatment, on
 * the argument that a validated instrument is an absence. In this build the
 * hatch means one thing, that nobody has recorded something, and it appears
 * nowhere else: the assessments under this notice were recorded, and a hatch
 * over them would say they were not. So it is a statement, in the info tint
 * with its words in the info ink. It stays until a real instrument is sourced.
 */
export function PlaceholderBanner() {
  return (
    <div className={styles.notice} data-placeholder-instrument role="note">
      <p className={styles.title}>This instrument is a placeholder</p>
      <p className={styles.body}>{PLACEHOLDER_NOTICE}</p>
    </div>
  )
}
