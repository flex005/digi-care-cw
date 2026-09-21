import { useState } from 'react'
import type {
  CareNote,
  CareNoteReview,
  IsoDateTime,
  Resident,
  ReviewOutcome,
} from '@/data/types'
import { REVIEW_OUTCOMES } from '@/data/types'
import {
  recordNoteReview,
  reviewRecordedThisSession,
  undoNoteReview,
} from '@/data/access/client'
import { staffLabel } from '@/data/access/team-store'
import { now } from '@/data/fixtures/clock'
import { Avatar, Button, Dialog, RadioGroup, TextField } from '@/components/primitives'
import { useSignedIn, useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { assertNever } from '@/lib/assert-never'
import styles from './notes.module.css'

/** What a review action did, for the screen to announce and to reload on. */
export type ReviewChange =
  | { kind: 'recorded'; noteId: CareNote['id']; review: CareNoteReview }
  | { kind: 'undone'; noteId: CareNote['id'] }

type Chosen = ReviewOutcome['kind'] | 'not_chosen'

/**
 * Marking a flagged note reviewed. CN-01.
 *
 * **Asked of the role table for this note's resident**, and drawn only on a yes.
 * The refusal is the caller's to draw, once, at the head of what it lists: a
 * refusal repeated down every row of a queue is noise.
 *
 * **"Action taken?" has no default.** A reviewer who confirmed without choosing
 * would have recorded "No further action needed" nobody said, so the confirm
 * stays unavailable until one of the four is chosen, and "Other" until it says
 * what was done.
 *
 * **The reviewer and the moment come from the session and the clock**, never
 * from a field, and the question names the resident (CLAUDE.md §2).
 *
 * **Nothing is sent.** The PRD pushes "Care plan updated" to the note's author;
 * this build has no pushes, so the line at the act says the author is not told,
 * and choosing "Incident raised" says no incident is created here. A reader who
 * believed either happened might not do it.
 *
 * **Undoable for the session.** Not an edit to the note, which never changes:
 * a review held in memory, which a mis-click would otherwise leave standing
 * over a care worker's request for help until somebody reloaded.
 */
export function ReviewNoteControl({
  note,
  resident,
  onChanged,
}: {
  note: CareNote
  resident: Resident
  onChanged: (change: ReviewChange) => void
}) {
  const viewer = useViewer()
  const { member } = useSignedIn()
  const format = useSiteFormat()
  const [open, setOpen] = useState(false)
  const [chosen, setChosen] = useState<Chosen>('not_chosen')
  const [otherText, setOtherText] = useState('')
  const [error, setError] = useState('')

  if (viewer.ask('mark_flagged_note_reviewed', note.residentId).kind !== 'yes')
    return null

  if (note.review.kind === 'reviewed') {
    // Only a review this session recorded is this person's to take back.
    if (!reviewRecordedThisSession(note.id)) return null
    const undo = () => {
      undoNoteReview({ noteId: note.id })
        .then(() => onChanged({ kind: 'undone', noteId: note.id }))
        .catch((cause: unknown) =>
          setError(
            cause instanceof Error ? cause.message : 'The review was not taken back.',
          ),
        )
    }
    return (
      <div className={styles.control} data-review-undo>
        <Button variant="secondary" size="large" onClick={undo}>
          Undo review
        </Button>
        <p className={styles.controlLine}>
          You recorded this review in this session, so you can take it back until you
          sign out.
        </p>
        {error === '' ? null : (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }

  if (note.review.kind !== 'flagged_not_reviewed') return null
  const flag = note.review

  const outcome = outcomeFrom(chosen, otherText)
  const reset = () => {
    setChosen('not_chosen')
    setOtherText('')
    setError('')
  }

  const confirm = () => {
    if (outcome.kind === 'incomplete') return
    recordNoteReview({
      noteId: note.id,
      by: member.ref,
      at: now().toISOString() as IsoDateTime,
      outcome: outcome.outcome,
    })
      .then((review) => {
        setOpen(false)
        reset()
        onChanged({ kind: 'recorded', noteId: note.id, review })
      })
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : 'The review was not recorded.',
        ),
      )
  }

  return (
    <>
      <Button variant="secondary" size="large" onClick={() => setOpen(true)}>
        Mark reviewed
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) reset()
        }}
        title={`Mark ${resident.fullLegalName}’s note reviewed?`}
        description="This records that you looked at it, and what was done. The note and its flag stay exactly as they are."
        actions={
          <>
            <Button
              variant="secondary"
              size="large"
              onClick={() => {
                setOpen(false)
                reset()
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="large"
              disabled={outcome.kind === 'incomplete'}
              onClick={confirm}
              data-confirm-review
            >
              Mark reviewed
            </Button>
          </>
        }
      >
        <div className={styles.dialogSubject} data-confirm-subject>
          <Avatar photo={resident.photo} name={resident.fullLegalName} size="medium" />
          <div className={styles.dialogWho}>
            <p className={styles.dialogName}>
              {resident.fullLegalName}{' '}
              <span className={styles.dialogPreferred}>
                known as {resident.preferredName}
              </span>
            </p>
            <p className={styles.dialogFacts}>
              {resident.room.kind === 'recorded'
                ? `Room ${resident.room.value}`
                : 'Room not recorded'}
              {' · Born '}
              <span data-numeric>{format.date(resident.dateOfBirth)}</span>
            </p>
          </div>
        </div>

        <p className={styles.dialogNote}>
          The note by {staffLabel(note.recordedBy)} at{' '}
          <span data-numeric>{format.dateTime(note.recordedAt)}</span>, flagged by{' '}
          {staffLabel(flag.flaggedBy)}.
        </p>

        <div className={styles.outcomes}>
          <p className={styles.legend}>Action taken?</p>
          <RadioGroup
            legend="Action taken?"
            options={REVIEW_OUTCOMES.map((entry) => ({
              value: entry.id,
              label: entry.label,
            }))}
            // '' rather than undefined, so the group is controlled from the first
            // render: nothing matches it, and nothing is chosen.
            value={chosen === 'not_chosen' ? '' : chosen}
            onValueChange={(value) => setChosen(value as ReviewOutcome['kind'])}
          />
          {chosen === 'other' ? (
            <TextField
              label="What was done?"
              value={otherText}
              onChange={setOtherText}
              hint="Required: “Other” is recorded with your words."
              data-other-outcome=""
            />
          ) : null}
        </div>

        {error === '' ? null : (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        )}
      </Dialog>
    </>
  )
}

/**
 * The outcome as chosen so far, or that it is not yet one. "Other" with nothing
 * in it is incomplete: the write refuses it too, and this only saves a trip.
 */
function outcomeFrom(
  chosen: Chosen,
  otherText: string,
): { kind: 'complete'; outcome: ReviewOutcome } | { kind: 'incomplete' } {
  switch (chosen) {
    case 'not_chosen':
      return { kind: 'incomplete' }
    case 'other':
      return otherText.trim() === ''
        ? { kind: 'incomplete' }
        : { kind: 'complete', outcome: { kind: 'other', text: otherText.trim() } }
    case 'no_further_action':
    case 'care_plan_updated':
    case 'incident_raised':
      return { kind: 'complete', outcome: { kind: chosen } }
    default:
      return assertNever(chosen)
  }
}
