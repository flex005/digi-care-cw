import Link from 'next/link'
import type { CareNote, Resident } from '@/data/types'
import { Avatar } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import { listName } from '@/features/residents/list-name'
import {
  CorrectionLinks,
  FlagReasonLine,
  FlagRecord,
  FlaggedMarker,
  NoteMeta,
  ShiftOverride,
  noteHref,
} from './note-parts'
import { ReviewNoteControl, type ReviewChange } from './ReviewNoteControl'
import { notesIcons } from './notes.icons'
import styles from './notes.module.css'

/**
 * Who a cross-resident row is about. On this screen the reader does not yet
 * know, and a note with no name on it cannot be read at all.
 */
export function RowSubject({ resident }: { resident: Resident }) {
  return (
    <div className={styles.rowSubject}>
      <Avatar photo={resident.photo} name={resident.fullLegalName} size="small" />
      <div className={styles.rowWho}>
        <Link className={styles.rowName} href={`/residents/${resident.id}/notes`}>
          {listName(resident)}
        </Link>
        <p className={styles.rowFacts}>
          {resident.room.kind === 'recorded'
            ? `Room ${resident.room.value}`
            : 'Room not recorded'}
        </p>
      </div>
    </div>
  )
}

function OpenNote({ note }: { note: CareNote }) {
  return (
    <Link className={styles.openLink} href={noteHref(note.residentId, note.id)}>
      Open this note
      <Icon name={notesIcons.open} size={16} />
    </Link>
  )
}

/**
 * One note on the flagged queue: who, how long it has waited, the note in full,
 * why it was flagged, and the review act where the role table says yes.
 *
 * **The note text is never truncated** (CN-01). A care note cut off mid-sentence
 * is a care note somebody misreads.
 */
export function FlaggedRow({
  note,
  resident,
  onChanged,
}: {
  note: CareNote
  resident: Resident
  onChanged: (change: ReviewChange) => void
}) {
  if (note.review.kind !== 'flagged_not_reviewed')
    throw new Error(`${note.id} is on the flagged queue and is not waiting for review.`)
  return (
    <li className={styles.row} data-note={note.id} data-flagged-row>
      <RowSubject resident={resident} />
      <div className={styles.rowFlag}>
        <FlaggedMarker flaggedAt={note.review.flaggedAt} />
      </div>
      <div className={styles.rowMain}>
        <p className={styles.body}>{note.body}</p>
        <NoteMeta note={note} showMood={false} />
        <FlagReasonLine reason={note.review.reason} />
        <ShiftOverride note={note} />
        <CorrectionLinks note={note} />
      </div>
      {/* At the end of the row, not under the note. Stacked beneath the words
          the acts read as the last line of the note rather than as the thing
          to do about it. */}
      <div className={styles.rowActs}>
        <ReviewNoteControl note={note} resident={resident} onChanged={onChanged} />
        <OpenNote note={note} />
      </div>
    </li>
  )
}

/**
 * One note anywhere else on the list: the note in full, its supervision record
 * and its place in a correction chain. A superseded note stays, marked.
 */
export function NoteRow({ note, resident }: { note: CareNote; resident: Resident }) {
  const superseded = note.supersededBy !== 'none'
  return (
    <li
      className={superseded ? styles.rowSuperseded : styles.row}
      data-note={note.id}
      data-superseded={superseded}
    >
      <RowSubject resident={resident} />
      <div className={styles.rowMain}>
        <p className={styles.body}>{note.body}</p>
        <NoteMeta note={note} />
        <ShiftOverride note={note} />
        <FlagRecord review={note.review} />
        <CorrectionLinks note={note} />
      </div>
      <div className={styles.rowActs}>
        <OpenNote note={note} />
      </div>
    </li>
  )
}
