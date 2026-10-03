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
import {
  VOCABULARY_NEEDS_SAYING,
  VOCABULARY_REQUEST,
  defaultVocabularyHref,
} from '@/lib/vocabulary-choice'
import styles from './MovedClockLine.module.css'

const hhmm = (at: Date) =>
  `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`

/**
 * What about this record is not the default, said in one quiet line.
 *
 * **One line, two facts, and deliberately not two lines.** It began as the
 * moved clock alone and now also carries the vocabulary, because a second
 * standing notice in the same position is the alarm-fatigue failure this build
 * records: a reader who learns to skim the strip skims whichever notice is in
 * it. The name is narrower than the job now; renaming it is a separate change
 * and is noted in PROGRESS.md rather than taken here.
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
  if (!CLOCK_NEEDS_SAYING && !VOCABULARY_NEEDS_SAYING) return null

  const round = roundInProgressAt(
    GENERATED_AT.getHours() * 60 + GENERATED_AT.getMinutes(),
  )

  /*
   * **Whether the clock moved at all.** A refusal does not move it, so where a
   * round is already running the record is drawn at the real time — and then
   * the number at the front of this line *is* the real time. Saying "the real
   * time" in the sentence and printing the same 14:30 again at the end gives
   * one fact three owners, none of which knows the others are there: the shape
   * this component was changed to fix, one line further in. Reachable on this
   * path alone, because every other route to an unmoved clock leaves
   * `CLOCK_NEEDS_SAYING` false and draws nothing.
   */
  const clockMoved = CLOCK_INSTANT !== 'real'

  /*
   * Which instant is on screen, for the cases where it is not the one the
   * reader would have assumed. A refused request still landed them somewhere,
   * and "it could not be read" without "so here is what you are looking at"
   * leaves them holding half the answer.
   *
   * From `CLOCK_INSTANT`, never from whether a round is in progress: the real
   * time at 14:30 is inside the 14:00 round, and calling that "the nearest one
   * running" tells a reader the clock was moved when it was not.
   *
   * The last arm is unreachable — a nearest-round instant is twenty minutes
   * into a round by construction — and says something true rather than naming
   * a round it has not got.
   */
  const showing =
    CLOCK_INSTANT === 'requested'
      ? 'the time you asked for'
      : round !== undefined
        ? `the ${round} round, which is the nearest one running`
        : 'the nearest round running'

  return (
    <p className={styles.line} data-moved-clock={CLOCK_REASON}>
      {CLOCK_NEEDS_SAYING ? (
        <>
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
              <b>“{CLOCK_REQUEST.raw}”</b> is not a time this can read, so it was
              ignored
              {clockMoved ? (
                <>
                  . Showing {showing}. Real time {hhmm(REAL_NOW)}.
                </>
              ) : (
                ', and the clock has not moved.'
              )}
            </span>
          ) : (
            /*
             * Here the clock did move, always: with a readable request or none at
             * all, an unmoved clock leaves `CLOCK_NEEDS_SAYING` false and this
             * component returns before it gets here.
             */
            <span>
              Showing {showing}. Real time {hhmm(REAL_NOW)}.
            </span>
          )}
          <a href={clockHref('real')} className={styles.link} data-clock-reset>
            Use the real time
          </a>
        </>
      ) : null}
      <VocabularyPart />
    </p>
  )
}

/**
 * What this organisation is being called, where that is not the default.
 *
 * **In this line rather than one of its own**, which is the whole decision. A
 * second permanent strip across every screen is the alarm-fatigue failure this
 * build already records: two notices in the same position teach a reader to
 * skim the position, and the one that matters is then the one they skim. So
 * there is one line saying what about this record is not ordinary, and it
 * carries the instant, the words, or both.
 *
 * It draws nothing at all under the default vocabulary, because the default is
 * what this product says and a line announcing it would be a notice about
 * nothing.
 */
function VocabularyPart() {
  /*
   * `nothing_asked` cannot reach the line — `VOCABULARY_NEEDS_SAYING` is false
   * for it — and the compiler is told rather than trusted, because a union
   * narrowed by a boolean somewhere else is not narrowed at all.
   */
  if (!VOCABULARY_NEEDS_SAYING || VOCABULARY_REQUEST.kind === 'nothing_asked')
    return null

  if (VOCABULARY_REQUEST.kind === 'unreadable')
    return (
      <span data-vocabulary="unreadable" data-vocabulary-raw={VOCABULARY_REQUEST.raw}>
        {/*
         * Quoted back and told what was wrong with it. A reader who typed
         * `subject:service-user` needs to see the word they used, not a
         * paraphrase they would have to guess their way back from.
         */}
        <b>“{VOCABULARY_REQUEST.raw}”</b> is not a vocabulary this can read, so it was
        ignored. {VOCABULARY_REQUEST.why} Showing this build’s own words.
      </span>
    )

  return (
    <>
      {/*
       * **What was asked for, quoted, and no claim about which words moved.**
       * A request may change the subject, the care plan, both or neither of
       * them, so a sentence naming one term would be wrong for most requests.
       * Quoting the request is true of all of them and is also what a reader
       * needs in order to change it.
       */}
      <span data-vocabulary="chosen">
        Showing the words you asked for: <b>{VOCABULARY_REQUEST.said}</b>. This build’s
        own are the care-home ones.
      </span>
      <a href={defaultVocabularyHref()} className={styles.link} data-vocabulary-reset>
        Use this build’s words
      </a>
    </>
  )
}
