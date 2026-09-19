import Link from 'next/link'
import type {
  CareNote,
  CareNoteCategoryId,
  CareNoteReview,
  FlagReason,
  IsoDateTime,
  ResidentId,
  ReviewOutcome,
} from '@/data/types'
import { CARE_NOTE_CATEGORIES, REVIEW_OUTCOMES } from '@/data/types'
import { staffLabel } from '@/data/access/team-store'
import { now } from '@/data/fixtures/clock'
import { MoodBadge, Settled, StatusPill, Unrecorded } from '@/components/status'
import { useSiteFormat } from '@/app/session/use-session'
import { assertNever } from '@/lib/assert-never'
import { formatLateness, pluralise } from '@/lib/format'
import { SHIFT_NAMES, elapsedMinutesBetween } from '@/lib/shift'
import styles from './notes.module.css'

/**
 * The parts a care note is made of, shared by every arrangement of it: the
 * list's rows, a resident's tab, the note on its own and the composer's
 * confirmation. **The facts are written once here** and only the arrangement is
 * decided by the caller, so a note cannot say one thing on the list and another
 * on its own page.
 */

/** Where one note lives. The route parameter is the subject (CLAUDE.md §2). */
export const noteHref = (residentId: ResidentId, noteId: CareNote['id']): string =>
  `/residents/${residentId}/notes/${noteId}`

/** A category's name, from the eight the home records against. */
export function CATEGORY_NAME(id: CareNoteCategoryId): string {
  const found = CARE_NOTE_CATEGORIES.find((category) => category.id === id)
  if (found === undefined) throw new Error(`No care note category ${id}`)
  return found.name
}

/**
 * What a reviewer said was done, in words. "Other" carries the reviewer's own,
 * because "Other" alone is not an outcome anybody can read later.
 */
export function REVIEW_OUTCOME_LABEL(outcome: ReviewOutcome): string {
  const label = (kind: ReviewOutcome['kind']) => {
    const found = REVIEW_OUTCOMES.find((entry) => entry.id === kind)
    if (found === undefined) throw new Error(`No review outcome ${kind}`)
    return found.label
  }
  switch (outcome.kind) {
    case 'no_further_action':
    case 'care_plan_updated':
    case 'incident_raised':
      return label(outcome.kind)
    case 'other':
      return `${label('other')}: ${outcome.text}`
    default:
      return assertNever(outcome)
  }
}

/**
 * How long a flag has waited, in the unit somebody would say it in.
 *
 * Minutes under an hour, hours under two days, then days by `formatLateness`,
 * which owns a span of days. Below two days the hour is the useful unit: the
 * difference between six and eighteen hours matters and "0 days" says nothing.
 */
export function formatWait(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes))
  if (whole < 60) return pluralise(whole, 'minute')
  const hours = Math.round(whole / 60)
  if (hours < 48) return pluralise(hours, 'hour')
  return formatLateness(Math.round(hours / 24))
}

/** How long between two instants, as a wait. */
export const waitBetween = (from: IsoDateTime, to: IsoDateTime): string =>
  formatWait(elapsedMinutesBetween(from, to))

/** How long a flag raised at `from` has been waiting, as of the record's moment. */
export const waitingSince = (from: IsoDateTime): string =>
  waitBetween(from, now().toISOString() as IsoDateTime)

/**
 * Category, author, date and time, shift and mood, on one line.
 *
 * Author and time always visible, never hover-only (CLAUDE.md §6). `showMood`
 * is false on the flagged queue only, where a hatched "Mood not recorded"
 * would compete with the flag for the one thing that row asks the reader to
 * see; the mood is still stated on the note itself.
 */
export function NoteMeta({
  note,
  showMood = true,
}: {
  note: CareNote
  showMood?: boolean
}) {
  const format = useSiteFormat()
  return (
    <p className={styles.meta} data-note-meta>
      {/*
       * Five facts of four different kinds, told apart by shape rather than by
       * the order somebody remembers them in. They were one weight and one
       * colour in a row, which read as a single grey string: what the note is
       * about, who wrote it, when, on which shift and how the resident seemed
       * are answers to five questions, and a reader scanning a page of notes
       * is looking for one of them at a time.
       */}
      <span className={styles.category} data-meta="category">
        {CATEGORY_NAME(note.category)}
      </span>
      <span className={styles.author} data-meta="author">
        {staffLabel(note.recordedBy)}
      </span>
      <span className={styles.when} data-meta="when" data-numeric>
        {format.dateTime(note.recordedAt)}
      </span>
      <span className={styles.shift} data-meta="shift">
        {SHIFT_NAMES[note.shift.value]} shift
      </span>
      {showMood ? <MoodBadge mood={note.mood} /> : null}
    </p>
  )
}

/**
 * A shift somebody changed, from what, and why. Without `clockSaid` a moved
 * shift would look like one nobody touched.
 */
export function ShiftOverride({ note }: { note: CareNote }) {
  if (note.shift.kind !== 'overridden') return null
  return (
    <p className={styles.shiftOverride} data-shift-override>
      <span className={styles.overrideLabel}>Shift changed</span> The clock said{' '}
      {SHIFT_NAMES[note.shift.clockSaid].toLowerCase()}, recorded as{' '}
      {SHIFT_NAMES[note.shift.value].toLowerCase()}: “{note.shift.reason}”
    </p>
  )
}

/**
 * Why somebody flagged a note, in their words, or plainly that they gave none.
 *
 * **"No reason given" is plain, not hatched.** Giving a reason is optional
 * (CN-02), so skipping it is a recorded choice, not a record nobody made; the
 * flag itself is what waits.
 */
export function FlagReasonLine({ reason }: { reason: FlagReason }) {
  return (
    <p className={styles.reason} data-flag-reason={reason.kind}>
      <span className={styles.reasonLabel}>Why flagged</span>{' '}
      <FlagReasonText reason={reason} />
    </p>
  )
}

/** The reason alone, for where a label beside it already says what it is. */
export function FlagReasonText({ reason }: { reason: FlagReason }) {
  switch (reason.kind) {
    case 'given':
      return <>“{reason.text}”</>
    case 'not_given':
      return <>No reason given</>
    default:
      return assertNever(reason)
  }
}

/**
 * The flag waiting on a senior, as a marker. Hatched, because a second opinion
 * somebody asked for and nobody has given is a gap in the record, not a
 * finding: amber would say somebody looked.
 */
export function FlaggedMarker({ flaggedAt }: { flaggedAt: IsoDateTime }) {
  return (
    <Unrecorded
      variant="chip"
      label="Flagged, not reviewed"
      detail={`waiting ${waitingSince(flaggedAt)}`}
    />
  )
}

/**
 * The supervision record on one note, as separate facts: who flagged it and
 * why, and, once somebody has, who reviewed it, when, and what they did.
 *
 * **A compound state renders as separate facts.** "Reviewed" is quiet, because
 * a senior looked and said what was done; the flag it answered stays beside
 * it, because the record is that somebody asked and somebody answered.
 *
 * Not flagged renders nothing. Flagging is something a person chooses to do,
 * not a record anybody owes, so an unflagged note is not a gap.
 */
export function FlagRecord({ review }: { review: CareNoteReview }) {
  const format = useSiteFormat()

  switch (review.kind) {
    case 'not_flagged':
      return null

    case 'flagged_not_reviewed':
      return (
        <div className={styles.flagRecord} data-flag-record="waiting">
          <FlaggedMarker flaggedAt={review.flaggedAt} />
          <p className={styles.flagLine}>
            Flagged by {staffLabel(review.flaggedBy)},{' '}
            <span data-numeric>{format.dateTime(review.flaggedAt)}</span>
          </p>
          <FlagReasonLine reason={review.reason} />
        </div>
      )

    case 'reviewed': {
      const samePerson = review.flaggedBy.id === review.reviewedBy.id
      return (
        <div className={styles.flagRecord} data-flag-record="reviewed">
          <Settled
            label={samePerson ? 'Flagged and reviewed by the same person' : 'Reviewed'}
            detail={`${staffLabel(review.reviewedBy)}, ${format.dateTime(review.reviewedAt)}`}
          />
          <p className={styles.outcome} data-review-outcome={review.outcome.kind}>
            <span className={styles.reasonLabel}>Action taken</span>{' '}
            {REVIEW_OUTCOME_LABEL(review.outcome)}
          </p>
          <p className={styles.flagLine}>
            Flagged by {staffLabel(review.flaggedBy)},{' '}
            <span data-numeric>{format.dateTime(review.flaggedAt)}</span>, and waited{' '}
            {waitBetween(review.flaggedAt, review.reviewedAt)}
          </p>
          <FlagReasonLine reason={review.reason} />
        </div>
      )
    }

    default:
      return assertNever(review)
  }
}

/**
 * Where a note sits in a correction chain, **both ways**. A superseded note
 * stays on the record and says it was corrected, and a correction says what it
 * corrects: either read alone is misleading, and a link lands on one of them.
 */
export function CorrectionLinks({ note }: { note: CareNote }) {
  if (note.supersededBy === 'none' && note.corrects === 'none') return null
  return (
    <div className={styles.chain} data-correction-chain>
      {note.supersededBy === 'none' ? null : (
        <span className={styles.chainItem} data-superseded>
          <StatusPill tone="info" label="Superseded by a correction" />
          <Link
            className={styles.inlineLink}
            href={noteHref(note.residentId, note.supersededBy)}
          >
            Open the correction
          </Link>
        </span>
      )}
      {note.corrects === 'none' ? null : (
        <span className={styles.chainItem} data-corrects>
          <StatusPill tone="info" label="Correction" />
          <Link
            className={styles.inlineLink}
            href={noteHref(note.residentId, note.corrects)}
          >
            Open the note it corrects
          </Link>
        </span>
      )}
    </div>
  )
}
