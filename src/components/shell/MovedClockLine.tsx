import {
  CLOCK_IS_OVERRIDDEN,
  CLOCK_REASON,
  GENERATED_AT,
  REAL_NOW,
  clockHref,
} from '@/data/fixtures/clock'
import { roundInProgressAt } from '@/data/fixtures/rounds'
import styles from './MovedClockLine.module.css'

const hhmm = (at: Date) =>
  `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`

/**
 * The record was drawn at a time other than now, said in one quiet line.
 *
 * **On every screen**, because every record in the build is generated against
 * this instant and there is no screen it does not reach. **Quiet**, because it
 * is a notice and not a finding: nobody needs to act on it, and spending the
 * caution colour on it would teach a reader to skim past caution.
 *
 * The link reloads the page, and a reload signs you out: nothing in this build
 * persists, and the record has to be regenerated against the new instant.
 */
export function MovedClockLine() {
  if (!CLOCK_IS_OVERRIDDEN) return null

  const round = roundInProgressAt(
    GENERATED_AT.getHours() * 60 + GENERATED_AT.getMinutes(),
  )

  return (
    <p className={styles.line} data-moved-clock={CLOCK_REASON}>
      <span className={styles.now} data-numeric>
        {hhmm(GENERATED_AT)}
      </span>
      <span>
        {CLOCK_REASON === 'nearest_round' && round !== undefined
          ? `Showing the ${round} round, which is the nearest one running. Real time ${hhmm(REAL_NOW)}.`
          : `Showing the time you asked for. Real time ${hhmm(REAL_NOW)}.`}
      </span>
      <a href={clockHref('real')} className={styles.link} data-clock-reset>
        Use the real time
      </a>
    </p>
  )
}
