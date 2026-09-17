import { useState } from 'react'
import Link from 'next/link'
import type { CareNote, IsoDateTime, Resident, Shift } from '@/data/types'
import { submitCorrectionNote } from '@/data/access/client'
import { staffLabel } from '@/data/access/team-store'
import { now } from '@/data/fixtures/clock'
import { ActLine, Button } from '@/components/primitives'
import { ActPoint } from '@/components/layout/ActPoint'
import { useSignedIn } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { useOpenRecord } from '@/features/residents/profile/ProfileContext'
import { listName } from '@/features/residents/list-name'
import { shiftAt } from '@/lib/shift'
import { NoteForm, NO_REFUSAL, refusalOf, type Refusal } from './composer/NoteForm'
import { EMPTY_FIELDS, toSubmission, type NoteFields } from './composer/note-fields'
import { announceNoteSaved } from './composer/SavedNoteToast'
import styles from './composer/composer.module.css'

/**
 * "Add a correction" on one care note. CW PRD CN-02; docs/DEPARTURES.md, Care
 * notes: only the author corrects a note.
 *
 * **A correction is a second note, never an edit.** The original stays exactly
 * as it was written and is marked superseded; the correction says what was
 * actually the case, with its own author and time.
 *
 * **Only the note's author corrects it**, in both roles. Anybody else is told
 * who wrote it, and what to do instead: speak to them, or write their own note
 * saying what they found. Flagging somebody else's note is not open to them,
 * because a flag is placed by the note's author.
 *
 * The form is the composer's, with the subject strip, opened in place and
 * starting from nothing but the original's category. It keeps no draft: it is
 * opened on purpose, on one note, and cancelling it throws it away.
 */
export function CorrectNoteAct({
  note,
  resident,
  onWritten,
}: {
  note: CareNote
  resident: Resident
  onWritten: (correction: CareNote) => void
}) {
  const record = useOpenRecord()
  const viewer = useViewer()
  const { member } = useSignedIn()

  const [open, setOpen] = useState<
    { kind: 'closed' } | { kind: 'open'; clockShift: Shift }
  >({ kind: 'closed' })
  const [fields, setFields] = useState<NoteFields>(EMPTY_FIELDS)
  const [refusal, setRefusal] = useState<Refusal>(NO_REFUSAL)
  const [saving, setSaving] = useState(false)

  /* The wrong-subject failure, caught before anything is drawn (CLAUDE.md §2). */
  if (record.resident.id !== resident.id || note.residentId !== resident.id)
    throw new Error(
      `A correction for ${note.id} was drawn about ${resident.id} inside ${record.resident.id}'s record.`,
    )

  if (note.supersededBy !== 'none')
    return (
      <div className={styles.correction} data-correct-note="already_corrected">
        <p className={styles.immutable}>
          This note has been corrected.{' '}
          <Link
            href={`/residents/${resident.id}/notes/${note.supersededBy}`}
            className={styles.link}
          >
            Read the correction
          </Link>
        </p>
      </div>
    )

  const answer = viewer.askOfRecord('correct_care_note', {
    resident: resident.id,
    writtenBy: note.recordedBy,
  })

  switch (answer.kind) {
    case 'yes':
      break
    case 'not_the_author': {
      const mayWrite = viewer.ask('write_care_note', resident.id).kind === 'yes'
      return (
        <div className={styles.correction} data-correct-note="not_the_author">
          <ActPoint answer={answer} label="Add a correction" notBuilt="" />
          <ActLine kind="refused">
            {mayWrite
              ? `If you believe it is wrong, speak to ${staffLabel(answer.author)}, or write your own note saying what you found.`
              : `If you believe it is wrong, speak to ${staffLabel(answer.author)}.`}
          </ActLine>
          {mayWrite ? (
            <Link
              href={`/residents/${resident.id}/notes/new`}
              className={styles.link}
              data-write-own-note
            >
              Write your own note about {resident.preferredName}
            </Link>
          ) : null}
        </div>
      )
    }
    default:
      return (
        <div className={styles.correction} data-correct-note={answer.kind}>
          <ActPoint
            answer={answer}
            label="Add a correction"
            notBuilt=""
            residentName={listName(resident)}
          />
        </div>
      )
  }

  if (open.kind === 'closed')
    return (
      <div className={styles.correction} data-correct-note="closed">
        <Button
          variant="secondary"
          size="large"
          onClick={() => {
            setFields({ ...EMPTY_FIELDS, category: note.category })
            setRefusal(NO_REFUSAL)
            setOpen({
              kind: 'open',
              clockShift: shiftAt(
                now().toISOString() as IsoDateTime,
                record.site.timeZone,
              ),
            })
          }}
        >
          Add a correction
        </Button>
      </div>
    )

  const save = async () => {
    const at = now().toISOString() as IsoDateTime
    const submission = toSubmission(fields, open.clockShift, member.ref, at)
    if (submission === 'incomplete') return
    setSaving(true)
    try {
      const correction = await submitCorrectionNote({
        corrects: note.id,
        residentId: resident.id,
        ...submission,
        author: member.ref,
        at,
      })
      setSaving(false)
      setOpen({ kind: 'closed' })
      setFields(EMPTY_FIELDS)
      announceNoteSaved(
        `Correction saved for ${listName(resident)}.`,
        'The original note stays on the record, marked as corrected.',
      )
      onWritten(correction)
    } catch (failure) {
      setRefusal(refusalOf(failure))
      setSaving(false)
    }
  }

  return (
    <div className={styles.correction} data-correct-note="open">
      <NoteForm
        resident={resident}
        site={record.site}
        title={`Correction for ${resident.preferredName}`}
        clockShift={open.clockShift}
        fields={fields}
        onChange={(next) => {
          setFields(next)
          setRefusal(NO_REFUSAL)
        }}
        phrases="not_offered"
        bodyLabel="What was actually the case? Written for whoever reads this next."
        submitLabel={`Save correction for ${listName(resident)}`}
        refusal={refusal}
        saving={saving}
        onSubmit={() => void save()}
        notice={
          <p className={styles.hint}>
            The note you are correcting stays on the record as it was written.
          </p>
        }
        secondaryAct={
          <Button
            variant="ghost"
            size="large"
            onClick={() => setOpen({ kind: 'closed' })}
          >
            Cancel
          </Button>
        }
      />
    </div>
  )
}
