import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { IsoDateTime } from '@/data/types'
import { submitCareNote } from '@/data/access/client'
import { now } from '@/data/fixtures/clock'
import { Button } from '@/components/primitives'
import { ActPoint } from '@/components/layout/ActPoint'
import { useSignedIn, useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { useOpenRecord } from '@/features/residents/profile/ProfileContext'
import { listName } from '@/features/residents/list-name'
import { shiftAt } from '@/lib/shift'
import { NoteForm, NO_REFUSAL, refusalOf, type Refusal } from './NoteForm'
import { EMPTY_FIELDS, toSubmission, type NoteFields } from './note-fields'
import { discardDraft, keepDraft, keptDraft, type KeptDraft } from './draft-store'
import { announceNoteSaved } from './SavedNoteToast'
import styles from './composer.module.css'

/**
 * Writing a care note about one resident. CW PRD CN-02.
 *
 * **The subject is the resident in the address** (CLAUDE.md §2): the profile
 * layout loads them by the route parameter and this reads them from there, so
 * nothing that came before can hand the composer a different person.
 *
 * Asked before it is drawn: a viewer the role table does not let write about
 * this resident gets the answer at the act and no form.
 *
 * **Drafts are kept for the session as somebody types**, per person and per
 * resident, and a return says so. There is no "Save as draft" link, because
 * there is nothing a draft would need saving from, and no dialog on leaving.
 * See `draft-store.ts`.
 */
export function NoteComposerRoute() {
  const { resident, site } = useOpenRecord()
  const viewer = useViewer()
  const { member } = useSignedIn()
  const router = useRouter()
  const format = useSiteFormat()

  /* Read once, when the composer opens, so the shift shown is the shift saved. */
  const [clockShift] = useState(() =>
    shiftAt(now().toISOString() as IsoDateTime, site.timeZone),
  )
  const [restored, setRestored] = useState<KeptDraft | 'none'>(() =>
    keptDraft(member.id, resident.id),
  )
  const [fields, setFields] = useState<NoteFields>(() =>
    restored === 'none' ? EMPTY_FIELDS : restored.fields,
  )
  const [refusal, setRefusal] = useState<Refusal>(NO_REFUSAL)
  const [saving, setSaving] = useState(false)

  const answer = viewer.ask('write_care_note', resident.id)
  if (answer.kind !== 'yes')
    return (
      <div className={styles.page} data-note-composer="refused">
        <ActPoint
          answer={answer}
          label="Write a care note"
          /* Drawn only for a yes, which never reaches this branch. */
          notBuilt=""
          residentName={listName(resident)}
        />
      </div>
    )

  const change = (next: NoteFields) => {
    setFields(next)
    setRefusal(NO_REFUSAL)
    keepDraft(member.id, resident.id, next, now().toISOString() as IsoDateTime)
  }

  const save = async () => {
    const at = now().toISOString() as IsoDateTime
    const submission = toSubmission(fields, clockShift, member.ref, at)
    if (submission === 'incomplete') return
    setSaving(true)
    try {
      const note = await submitCareNote({
        residentId: resident.id,
        ...submission,
        author: member.ref,
        at,
      })
      discardDraft(member.id, resident.id)
      announceNoteSaved(
        `Note saved for ${listName(resident)}.`,
        note.review.kind === 'flagged_not_reviewed'
          ? 'Flagged for a senior to review. Nobody is notified: it waits in the flagged queue.'
          : 'none',
      )
      router.push(`/residents/${resident.id}/notes`)
    } catch (failure) {
      setRefusal(refusalOf(failure))
      setSaving(false)
    }
  }

  const keptAtWords = (kept: KeptDraft) =>
    format.instantDate(kept.keptAt) ===
    format.instantDate(now().toISOString() as IsoDateTime)
      ? format.time(kept.keptAt)
      : format.dateTime(kept.keptAt)

  return (
    <div className={styles.page} data-note-composer="open">
      <NoteForm
        resident={resident}
        site={site}
        title={`Care note for ${resident.preferredName}`}
        clockShift={clockShift}
        fields={fields}
        onChange={change}
        phrases="offered"
        bodyLabel="Written for whoever reads this next: a manager tonight, an inspector in a year."
        submitLabel={`Save note for ${listName(resident)}`}
        refusal={refusal}
        saving={saving}
        onSubmit={() => void save()}
        notice={
          restored === 'none' ? null : (
            <p className={styles.draftLine} data-draft-restored>
              <span>Draft from {keptAtWords(restored)} kept for this session.</span>
              <Button
                variant="ghost"
                size="small"
                onClick={() => {
                  discardDraft(member.id, resident.id)
                  setRestored('none')
                  setFields(EMPTY_FIELDS)
                  setRefusal(NO_REFUSAL)
                }}
              >
                Discard draft
              </Button>
            </p>
          )
        }
        secondaryAct={null}
      />
    </div>
  )
}
