import { useState } from 'react'
import Link from 'next/link'
import type { CareNote, IsoDateTime, Resident, Shift } from '@/data/types'
import { submitCorrectionNote } from '@/data/access/client'
import { now } from '@/data/fixtures/clock'
import { Button, Dialog } from '@/components/primitives'
import { ActPoint } from '@/components/layout/ActPoint'
import { useSignedIn } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { useOpenRecord } from '@/features/residents/profile/ProfileContext'
import { listName } from '@/features/residents/list-name'
import { shiftAt } from '@/lib/shift'
import { NoteComposer } from './composer/NoteComposerRoute'
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
 * **Only the note's author corrects it**, in both roles. Anybody else is
 * offered the thing that *is* theirs — writing their own note saying what they
 * found — and nothing about whose note this is: the author is already on the
 * note a line above, and repeating it as a refusal told a reader about somebody
 * else's job rather than about their own. Flagging somebody else's note is not
 * open to them either, because a flag is placed by the note's author.
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
  const [writing, setWriting] = useState(false)
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
    /*
     * **Somebody else wrote it, so there is no correction to offer and nothing
     * said about whose note it is.** The panel used to draw a disabled "Add a
     * correction" with the role table's reason and a line naming the author.
     * The author is already on the note, a line above; repeating it as a
     * refusal told a reader about somebody else's job rather than about theirs.
     *
     * What is theirs is writing their own note saying what they found, so that
     * is the only thing here — and it opens over the note rather than at a
     * second address, as it does on the Care Notes tab.
     */
    case 'not_the_author': {
      if (viewer.ask('write_care_note', resident.id).kind !== 'yes') return null
      return (
        <div className={styles.correction} data-correct-note="not_the_author">
          <Button variant="secondary" size="large" onClick={() => setWriting(true)}>
            Write your own note about {resident.preferredName}
          </Button>
          <Dialog
            open={writing}
            onOpenChange={setWriting}
            title={`Write a care note for ${resident.fullLegalName}`}
            size="form"
          >
            <NoteComposer
              onSaved={() => {
                setWriting(false)
                onWritten(note)
              }}
            />
          </Dialog>
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

  const save = async () => {
    if (open.kind !== 'open') return
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

  /*
   * **Over the note, not in place of it.** The form used to replace the button
   * and push the note it corrects off the top of the screen, which is the one
   * thing a correction is written against: the reader needs the original in
   * view while they say what was actually the case.
   */
  return (
    <div
      className={styles.correction}
      data-correct-note={open.kind === 'open' ? 'open' : 'closed'}
    >
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
      <Dialog
        open={open.kind === 'open'}
        onOpenChange={(next) => {
          if (!next) setOpen({ kind: 'closed' })
        }}
        title={`Correction for ${resident.fullLegalName}`}
        size="form"
      >
        {open.kind === 'open' ? (
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
        ) : null}
      </Dialog>
    </div>
  )
}
