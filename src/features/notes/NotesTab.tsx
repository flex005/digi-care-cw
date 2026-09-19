import { useCallback, useState } from 'react'
import Link from 'next/link'
import type { CareNote } from '@/data/types'
import { getCareNotes } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import {
  Button,
  Card,
  CardHead,
  Dialog,
  EmptyState,
  Pager,
  usePaged,
} from '@/components/primitives'
import { NeverWrittenUp, NotYourHome } from '@/components/status'
import { ActPoint } from '@/components/layout/ActPoint'
import { useViewer } from '@/app/session/use-viewer'
import { useOpenRecord } from '@/features/residents/profile/ProfileContext'
import { formatCount } from '@/lib/format'
import { assertNever } from '@/lib/assert-never'
import {
  CorrectionLinks,
  FlagRecord,
  NoteMeta,
  ShiftOverride,
  noteHref,
} from './note-parts'
import { NoteComposer } from './composer/NoteComposerRoute'
import { notesIcons } from './notes.icons'
import { Icon } from '@/components/icon/Icon'
import styles from './notes.module.css'

/**
 * A resident's care notes. RES-03's Care Notes tab.
 *
 * **Newest first, a page at a time, and the page says what it is a slice of.**
 * No gap markers between notes: a stretch between two rows drawn inside a page
 * would state a span whose ends the page break chose.
 *
 * Every note carries its whole record: author, time, shift and any change to
 * it, category, mood, whether it was flagged and why, who reviewed it and what
 * they did, and where it sits in a correction chain. **A superseded note stays**,
 * marked, because the fact that somebody first wrote the wrong thing is part of
 * the record.
 *
 * **Writing opens a dialog rather than a second screen.** The note is about the
 * resident whose record is already open, and sending the reader to their own
 * address to write it loses the list they were reading and the place they were
 * in it. The dialog carries the subject header with it, so what a page
 * guaranteed about the subject still holds (CLAUDE.md §2).
 *
 * Writing is asked of the role table for this resident, and drawn at the head.
 */
export function NotesTab() {
  const { resident } = useOpenRecord()
  const viewer = useViewer()

  const [writing, setWriting] = useState(false)
  /*
   * Bumped when a note is saved in the dialog, so the list behind it re-reads
   * rather than showing the record as it was before the note somebody just
   * wrote. The page it replaced got a fresh read by navigating.
   */
  const [saved, setSaved] = useState(0)

  const load = useCallback(() => getCareNotes(resident.id), [resident.id])
  const resource = useResource<CareNote[]>(load, [resident.id, saved])
  const notes = resource.kind === 'ready' ? resource.data : EMPTY
  const paged = usePaged(notes)

  const answer = viewer.ask('write_care_note', resident.id)

  return (
    <div className={styles.tabPanel} data-notes-tab>
      <Card>
        {/* The act sits on the head's own line, at its right: it is what this
            card is for, and under the subtitle it read as a footnote to it. */}
        <div className={styles.tabHead}>
          <div className={styles.tabHeading}>
            <CardHead
              title={`${resident.preferredName}’s care notes`}
              subtitle="Newest first. A care note is never changed once saved."
              expand={{ kind: 'whole' }}
            />
          </div>
          {answer.kind === 'yes' ? (
            <Button size="large" onClick={() => setWriting(true)} data-write-note>
              Write a care note
            </Button>
          ) : (
            <ActPoint
              answer={answer}
              label="Write a care note"
              notBuilt=""
              residentName={resident.preferredName}
            />
          )}
        </div>
      </Card>

      <Dialog
        open={writing}
        onOpenChange={setWriting}
        title={`Write a care note for ${resident.fullLegalName}`}
        size="form"
      >
        <NoteComposer
          onSaved={() => {
            setWriting(false)
            setSaved((count) => count + 1)
          }}
        />
      </Dialog>

      <Card>
        {(() => {
          switch (resource.kind) {
            case 'loading':
              return (
                <p className={styles.status} role="status">
                  Loading care notes…
                </p>
              )
            case 'refused':
              return <NotYourHome refusal={resource} />
            case 'error':
              return (
                <EmptyState
                  title="These care notes could not be loaded"
                  body="Nothing has been lost: this is a read."
                  actions={
                    <Button variant="secondary" onClick={resource.retry}>
                      Try again
                    </Button>
                  }
                />
              )
            case 'ready':
              return notes.length === 0 ? (
                <NeverWrittenUp variant="panel" />
              ) : (
                <>
                  <p className={styles.claim} data-tab-claim>
                    <span data-numeric>{formatCount(notes.length)}</span>{' '}
                    {notes.length === 1 ? 'care note' : 'care notes'} on the record for{' '}
                    {resident.preferredName}, newest first
                  </p>
                  <ul className={styles.rows}>
                    {paged.shown.map((note) => (
                      <TabNote key={note.id} note={note} />
                    ))}
                  </ul>
                  <Pager paged={paged} total={notes.length} noun="care notes" />
                </>
              )
            default:
              return assertNever(resource)
          }
        })()}
      </Card>
    </div>
  )
}

const EMPTY: CareNote[] = []

function TabNote({ note }: { note: CareNote }) {
  const superseded = note.supersededBy !== 'none'
  return (
    <li
      className={superseded ? styles.tabNoteSuperseded : styles.tabNote}
      data-note={note.id}
      data-superseded={superseded}
    >
      <div className={styles.tabNoteText}>
        <p className={styles.body}>{note.body}</p>
        <NoteMeta note={note} />
        <ShiftOverride note={note} />
        <FlagRecord review={note.review} />
        <CorrectionLinks note={note} />
      </div>
      {/* At the right of the row, not under the note: it is what to do with
          this note, not another fact about it. */}
      <Link className={styles.openLink} href={noteHref(note.residentId, note.id)}>
        Open this note
        <Icon name={notesIcons.open} size={16} />
      </Link>
    </li>
  )
}
