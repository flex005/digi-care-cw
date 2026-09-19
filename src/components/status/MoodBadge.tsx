import type { MoodRecord } from '@/data/types'
import { MOOD_LABELS } from '@/data/types'
import { assertNever } from '@/lib/assert-never'
import { Unrecorded } from './Unrecorded'
import styles from './MoodBadge.module.css'

/**
 * The five-point mood scale from a care note.
 *
 * Always a word, never a face alone — the source PRD's "5 face icons" are
 * unreadable to a screen reader and ambiguous to everyone else, so the Admin build
 * requires each to carry a text label. Here only the word is used.
 *
 * **A recorded mood is one item on a meta line: "mood low".** It is an
 * observation attached to a note, not a status anybody discharges, and the
 * note body carries the substance. As a filled pill it outweighed the note it
 * annotated; as its own labelled block with its own attribution it took three
 * lines of a row to say one word.
 *
 * It carries no author and no timestamp of its own, because it has neither:
 * a mood is recorded as part of writing the note, so the note's author and
 * time are the mood's. (The fixtures currently draw a separate author for it
 * — see PROGRESS.md; that is a fixture fact-error, not a thing to render.)
 *
 * Quiet at every score, including the low ones. A low mood is a recorded fact
 * and the note says what happened; quieting a *record* is not the forbidden
 * move. Quieting a **gap** is, which is why `not_recorded` keeps the hatch: a
 * care worker who did not record how someone seemed has not recorded that
 * they seemed fine.
 *
 * **Quiet, and still its own object.** It was bare words inheriting whatever
 * line it sat on, which on a note's meta line put it in the same grey at the
 * same size as the timestamp beside it: five facts read as one string. The
 * chip is neutral ground rather than a status hue, so it is told apart from
 * its neighbours without being told apart from an ordinary day.
 */
export function MoodBadge({ mood }: { mood: MoodRecord }) {
  switch (mood.kind) {
    case 'not_recorded':
      return <Unrecorded label="Mood not recorded" />

    case 'recorded':
      return (
        <span className={styles.mood} data-mood={mood.score}>
          mood {MOOD_LABELS[mood.score].toLowerCase()}
        </span>
      )

    default:
      return assertNever(mood)
  }
}
