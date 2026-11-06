import { useCallback, useEffect, useRef, useState } from 'react'
import { getCareNotes, getResident } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import type { CareNote, ResidentId } from '@/data/types'
import { phoneRefusalOf } from '../phone-refusal'
import { useSignedIn, useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { ActLine } from '@/components/primitives'
import { ROWS_PER_PAGE } from '@/components/primitives/Pager'
import { Unrecorded } from '@/components/status'
import { staffLabel } from '@/data/access/team-store'
import { MOOD_LABELS } from '@/data/types'
import { CATEGORY_NAME, FlagRecord, ShiftOverride } from '@/features/notes/note-parts'
import { SHIFT_NAMES } from '@/lib/shift'
import { pluralise } from '@/lib/format'
import { notBuiltOnPhone } from '../not-built'
import { listName, type Person } from '../phone-data'
import { Loaded } from '../ScreenStates'
import { useInFront } from '../shell/nav'
import { Screen } from '../shell/Screen'
import shell from '../shell/shell.module.css'
import { SubjectHeader } from '../SubjectHeader'
import styles from '../phone.module.css'

interface NotesData {
  person: Person
  notes: CareNote[]
}

/**
 * One person's care notes, read-only, newest first. CW PRD CN-01, for one
 * resident, pushed from their record.
 *
 * **Every note in full**, with the parts the desktop draws them with
 * (`note-parts.tsx`): category, author and time, shift and mood, a changed
 * shift and why, and the flag and its review. **A correction and the note it
 * corrects are both shown, each saying so**, because either read alone is
 * misleading and the original stays on the record exactly as written.
 *
 * Nothing here edits or deletes. Correcting is not built on the phone, and the
 * reader's own notes say so where the act would be; somebody else's say
 * nothing, because only the author corrects a note.
 */
export function NotesScreen({ id }: { id: ResidentId }) {
  const viewer = useViewer()
  const inFront = useInFront()
  const answer = viewer.ask('open_resident_record', id)
  const [reads, setReads] = useState(0)
  const wasInFront = useRef(inFront)
  useEffect(() => {
    if (inFront && !wasInFront.current) setReads((count) => count + 1)
    wasInFront.current = inFront
  }, [inFront])

  const load = useCallback(
    () =>
      Promise.all([getResident(id), getCareNotes(id)]).then(
        ([person, notes]): NotesData => ({ person, notes }),
      ),
    [id],
  )
  const resource = useResource<NotesData>(load, [id, reads])
  const ready = resource.kind === 'ready' ? resource.data : undefined

  return (
    <Screen
      title="Care notes"
      subject={
        ready !== undefined && answer.kind === 'yes' ? (
          <SubjectHeader person={ready.person} name="here" />
        ) : undefined
      }
    >
      <Loaded
        resource={resource}
        loading="Loading care notes…"
        failed="The care notes could not be loaded"
      >
        {(data) =>
          answer.kind !== 'yes' ? (
            <div className={styles.card}>
              <p className={styles.cardTitle}>
                {phoneRefusalOf(answer, listName(data.person))}
              </p>
            </div>
          ) : (
            <NoteList notes={data.notes} />
          )
        }
      </Loaded>
    </Screen>
  )
}

/**
 * What the list says it is showing: what is on screen and what exists, always
 * both. "395 care notes" over the newest 25 would be a claim about a list the
 * reader is not looking at; "all" is said when it is all, so the end of the
 * list cannot be mistaken for the end of a batch.
 */
export function showingLine(shown: number, total: number): string {
  if (shown >= total)
    return total === 1
      ? 'Showing the only care note.'
      : `Showing all ${pluralise(total, 'care note')}, newest first.`
  return `Showing the newest ${shown} of ${pluralise(total, 'care note')}.`
}

function NoteList({ notes }: { notes: CareNote[] }) {
  const { member } = useSignedIn()
  const format = useSiteFormat()
  /* The desktop's page size, so the two surfaces agree on what a batch is. */
  const [shown, setShown] = useState(ROWS_PER_PAGE)
  if (notes.length === 0)
    return (
      <p className={`${styles.quiet} ${styles.gutter}`}>
        Nobody has ever written a care note for them.
      </p>
    )

  const newestFirst = [...notes].sort((a, b) =>
    b.recordedAt.localeCompare(a.recordedAt),
  )
  const byId = new Map(notes.map((note) => [note.id, note]))
  const when = (noteId: CareNote['id']) => {
    const found = byId.get(noteId)
    return found === undefined ? 'an earlier note' : format.dateTime(found.recordedAt)
  }

  const onScreen = Math.min(shown, notes.length)
  const remaining = notes.length - onScreen
  return (
    <>
      <p className={`${styles.quiet} ${styles.gutter}`} role="status" data-showing>
        {showingLine(onScreen, notes.length)}
      </p>
      <ul className={styles.list} data-notes>
        {newestFirst.slice(0, onScreen).map((note) => (
          <li key={note.id} className={styles.note} data-note={note.id}>
            <p className={styles.noteBody}>{note.body}</p>
            <Provenance note={note} />
            <ShiftOverride note={note} form="phone" />
            <FlagRecord review={note.review} form="phone" />
            {note.corrects === 'none' ? null : (
              <p className={styles.quiet} data-corrects>
                A correction of the note written {when(note.corrects)}, which stays on
                the record below.
              </p>
            )}
            {note.supersededBy === 'none' ? null : (
              <p className={styles.quiet} data-superseded>
                Superseded by a correction written {when(note.supersededBy)}. Kept as it
                was written.
              </p>
            )}
            {note.recordedBy.id === member.ref.id ? (
              <ActLine kind="not_built">
                {notBuiltOnPhone('Correcting a care note')}
              </ActLine>
            ) : null}
          </li>
        ))}
      </ul>
      {remaining === 0 ? null : (
        <div className={styles.gutter}>
          <button
            type="button"
            className={`${styles.pill} ${shell.press}`}
            onClick={() => setShown((count) => count + ROWS_PER_PAGE)}
          >
            Show the next {Math.min(ROWS_PER_PAGE, remaining)}
          </button>
        </div>
      )}
      <p className={`${styles.byline} ${styles.gutter}`}>
        A care note is never changed once saved. A correction is kept with it.
      </p>
    </>
  )
}

/**
 * The phone's form of a note's provenance: under the note, not over it. The
 * note is the content; category, author, time, shift and mood say where it
 * came from, and **all five stay**, because a note whose author, time or shift
 * is hidden is worse than a busy one.
 *
 * Sentence case throughout, and one chip style for the shift and the mood.
 * The one exception is a mood nobody recorded, which keeps the hatch: an
 * absence never takes a recorded value's look (CLAUDE.md §1).
 */
function Provenance({ note }: { note: CareNote }) {
  const format = useSiteFormat()
  const category = CATEGORY_NAME(note.category)
  return (
    <div className={styles.provenance} data-note-meta>
      <p className={styles.provenanceLine}>
        <span data-meta="category">
          {category.charAt(0)}
          {category.slice(1).toLowerCase()}
        </span>
        <span aria-hidden="true">·</span>
        <span data-meta="author">{staffLabel(note.recordedBy)}</span>
        <span aria-hidden="true">·</span>
        <span data-meta="when" data-numeric>
          {format.dateTime(note.recordedAt)}
        </span>
      </p>
      <p className={styles.provenanceChips}>
        <span className={styles.factChip} data-meta="shift">
          {SHIFT_NAMES[note.shift.value]} shift
        </span>
        {note.mood.kind === 'recorded' ? (
          <span className={styles.factChip} data-meta="mood">
            Mood: {MOOD_LABELS[note.mood.score].toLowerCase()}
          </span>
        ) : (
          <Unrecorded label="Mood not recorded" />
        )}
      </p>
    </div>
  )
}
