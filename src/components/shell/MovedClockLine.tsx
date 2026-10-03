import {
  CLOCK_INSTANT,
  CLOCK_NEEDS_SAYING,
  CLOCK_REASON,
  CLOCK_REQUEST,
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
  if (!CLOCK_NEEDS_SAYING) return null

  const round = roundInProgressAt(
    GENERATED_AT.getHours() * 60 + GENERATED_AT.getMinutes(),
  )

  /*
   * Which instant is on screen, said the same way whatever brought the reader
   * here. A refused request still landed them somewhere, and "it could not be
   * read" without "so here is what you are looking at" leaves them holding
   * half the answer.
   *
   * From `CLOCK_INSTANT`, never from whether a round is in progress: the real
   * time at 14:30 is inside the 14:00 round, and calling that "the nearest one
   * running" tells a reader the clock was moved when it was not.
   */
  const showing =
    CLOCK_INSTANT === 'requested'
      ? 'the time you asked for'
      : CLOCK_INSTANT === 'nearest_round' && round !== undefined
        ? `the ${round} round, which is the nearest one running`
        : 'the real time'

  return (
    <p className={styles.line} data-moved-clock={CLOCK_REASON}>
      <span className={styles.now} data-numeric>
        {hhmm(GENERATED_AT)}
      </span>
      {CLOCK_REQUEST.kind === 'unreadable' ? (
        /*
         * **Quoted back, exactly as it arrived.** A reviewer who typed an ISO
         * offset sees `+01:00` came back as a space, which is the only way the
         * refusal explains itself; paraphrasing it would leave them retyping
         * the same thing.
         */
        <span data-clock-unreadable={CLOCK_REQUEST.raw}>
          <b>“{CLOCK_REQUEST.raw}”</b> is not a time this can read, so it was ignored.
          Showing {showing}. Real time {hhmm(REAL_NOW)}.
        </span>
      ) : (
        <span>
          Showing {showing}. Real time {hhmm(REAL_NOW)}.
        </span>
      )}
      <a href={clockHref('real')} className={styles.link} data-clock-reset>
        Use the real time
      </a>
    </p>
  )
}
