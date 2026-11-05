import { useCallback, useEffect, useRef, useState } from 'react'
import { getCareNotes, getResident } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import type { CareNote, ResidentId } from '@/data/types'
import { refusalOf } from '@/app/session/refusal'
import { useSignedIn, useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { ActLine } from '@/components/primitives'
import { FlagRecord, NoteMeta, ShiftOverride } from '@/features/notes/note-parts'
import { pluralise } from '@/lib/format'
import { notBuiltOnPhone } from '../not-built'
import { listName, type Person } from '../phone-data'
import { Loaded } from '../ScreenStates'
import { useInFront } from '../shell/nav'
import { Screen } from '../shell/Screen'
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
                {refusalOf(answer, listName(data.person))}
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

function NoteList({ notes }: { notes: CareNote[] }) {
  const { member } = useSignedIn()
  const format = useSiteFormat()
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

  return (
    <>
      <p className={`${styles.quiet} ${styles.gutter}`}>
        {pluralise(notes.length, 'care note')}, newest first.
      </p>
      <ul className={styles.list} data-notes>
        {newestFirst.map((note) => (
          <li key={note.id} className={styles.note} data-note={note.id}>
            <NoteMeta note={note} />
            <p className={styles.noteBody}>{note.body}</p>
            <ShiftOverride note={note} />
            <FlagRecord review={note.review} />
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
      <p className={`${styles.byline} ${styles.gutter}`}>
        A care note is never changed once saved. A correction is kept with it.
      </p>
    </>
  )
}
