import { useCallback, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import type { CareNote, CareNoteId, IsoDateTime } from '@/data/types'
import { MOOD_LABELS } from '@/data/types'
import { getCareNote, reviewRecordedThisSession } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { staffLabel } from '@/data/access/team-store'
import { now } from '@/data/fixtures/clock'
import { Button, Card, CardHead, EmptyState } from '@/components/primitives'
import { MoodBadge, NotYourHome, StatusPill, Unrecorded } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { ActPoint } from '@/components/layout/ActPoint'
import { useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { useOpenRecord } from '@/features/residents/profile/ProfileContext'
import { assertNever } from '@/lib/assert-never'
import { SHIFT_NAMES } from '@/lib/shift'
import {
  CATEGORY_NAME,
  FlagReasonText,
  REVIEW_OUTCOME_LABEL,
  ShiftOverride,
  noteHref,
  waitBetween,
} from './note-parts'
import { ReviewNoteControl } from './ReviewNoteControl'
import { CorrectNoteAct } from './CorrectNoteAct'
import { notesIcons } from './notes.icons'
import styles from './notes.module.css'

/** The note, and the notes either side of it in a correction chain. */
interface NoteWithChain {
  note: CareNote
  corrects: CareNote | 'none'
  correctedBy: CareNote | 'none'
}

const linked = (id: CareNoteId | 'none'): Promise<CareNote | 'none'> =>
  id === 'none' ? Promise.resolve('none') : getCareNote(id)

/**
 * One care note, whole. CN-02's "note cannot be edited after submission".
 *
 * **The subject is the address**: the resident from the profile layout, the
 * note from its parameter, and a note that is about somebody else is refused
 * rather than shown under this resident's head (CLAUDE.md §2).
 *
 * **No edit control, and it says why**, in one line, so a reader does not wait
 * for a pencil that is not coming. A mistake is fixed by a correction, which is
 * a second note; the chain is drawn both ways, because a link lands on one half
 * of it and either half alone misleads.
 *
 * The supervision record is stated in full: who flagged it and why, how long it
 * waited, who reviewed it, when, and what they did.
 */
export function NoteDetailRoute() {
  const { resident } = useOpenRecord()
  const params = useParams<{ noteId: string }>()
  const noteId = params.noteId as CareNoteId
  const viewer = useViewer()

  const [reloads, setReloads] = useState(0)
  const load = useCallback(
    () =>
      getCareNote(noteId).then(async (note): Promise<NoteWithChain> => ({
        note,
        corrects: await linked(note.corrects),
        correctedBy: await linked(note.supersededBy),
      })),
    [noteId],
  )
  const resource = useResource<NoteWithChain>(load, [noteId, reloads])
  const reload = () => setReloads((count) => count + 1)

  const back = (
    <Link href={`/residents/${resident.id}/notes`} className={styles.back}>
      <Icon name={notesIcons.back} size={16} />
      All of {resident.preferredName}’s care notes
    </Link>
  )

  switch (resource.kind) {
    case 'loading':
      return (
        <div className={styles.tabPanel}>
          {back}
          <Card>
            <p className={styles.status} role="status">
              Loading this note…
            </p>
          </Card>
        </div>
      )

    case 'refused':
      return (
        <div className={styles.tabPanel}>
          {back}
          <NotYourHome refusal={resource} />
        </div>
      )

    case 'error':
      return (
        <div className={styles.tabPanel}>
          {back}
          <Card>
            <EmptyState
              title="This note could not be loaded"
              body={`Nothing in this build answers to ${noteId}.`}
              actions={
                <Button variant="secondary" onClick={resource.retry}>
                  Try again
                </Button>
              }
            />
          </Card>
        </div>
      )

    case 'ready': {
      const { note, corrects, correctedBy } = resource.data

      /*
       * **Refused, not shown under the wrong head.** The note's resident is not
       * named: they may not be on this viewer's list, and the address is not a
       * way round that.
       */
      if (note.residentId !== resident.id)
        return (
          <div className={styles.tabPanel}>
            {back}
            <Card>
              <div className={styles.refusal} data-note-not-about-resident>
                <p className={styles.refusalTitle}>
                  This note is not about {resident.fullLegalName}.
                </p>
                <p className={styles.refusalBody}>
                  It belongs to another resident’s record, so it is not shown here.
                </p>
              </div>
            </Card>
          </div>
        )

      const reviewAnswer = viewer.ask('mark_flagged_note_reviewed', resident.id)

      return (
        <div className={styles.tabPanel} data-note-detail={note.id}>
          {back}
          <Card>
            <NoteHead note={note} />
            {note.supersededBy === 'none' ? null : (
              <div className={styles.chainNotice} data-superseded>
                <StatusPill tone="info" label="Superseded by a correction" />
                <span>This note stays on the record as it was written.</span>
              </div>
            )}
            <p className={styles.bodyLarge}>{note.body}</p>
            <NoteFacts note={note} />
            <ShiftOverride note={note} />
            <p className={styles.immutability} data-immutability>
              A care note is never changed once saved. A mistake is fixed with a
              correction, which keeps both.
            </p>
            {note.supersededBy === 'none' ? (
              <div className={styles.detailAct}>
                <CorrectNoteAct note={note} resident={resident} onWritten={reload} />
              </div>
            ) : null}
          </Card>

          <Card>
            <CardHead
              title="Supervision"
              subtitle="Whether this note was flagged for a senior, and what came of it."
              expand={{ kind: 'not_built' }}
            />
            <SupervisionRecord note={note} />
            {/*
             * The act where there is one: marking a waiting note reviewed, asked
             * of the role table and drawn with its refusal where the answer is
             * no, or taking back a review this session recorded.
             */}
            {note.review.kind === 'flagged_not_reviewed' &&
            reviewAnswer.kind !== 'yes' ? (
              <ActPoint
                answer={reviewAnswer}
                label="Mark reviewed"
                notBuilt=""
                residentName={resident.preferredName}
              />
            ) : note.review.kind === 'flagged_not_reviewed' ||
              reviewRecordedThisSession(note.id) ? (
              <div className={styles.detailAct}>
                <ReviewNoteControl note={note} resident={resident} onChanged={reload} />
              </div>
            ) : null}
          </Card>

          {corrects === 'none' && correctedBy === 'none' ? null : (
            <Card>
              <CardHead
                title="Correction"
                subtitle="Both notes stay on the record."
                expand={{ kind: 'not_built' }}
              />
              <ul className={styles.chainList} data-correction-chain>
                {corrects === 'none' ? null : (
                  <ChainLink
                    relation="This note corrects"
                    other={corrects}
                    data="corrects"
                  />
                )}
                {correctedBy === 'none' ? null : (
                  <ChainLink
                    relation="This note was corrected by"
                    other={correctedBy}
                    data="corrected-by"
                  />
                )}
              </ul>
            </Card>
          )}
        </div>
      )
    }

    default:
      return assertNever(resource)
  }
}

function NoteHead({ note }: { note: CareNote }) {
  const format = useSiteFormat()
  return (
    <CardHead
      title={note.corrects === 'none' ? 'Care note' : 'Care note: a correction'}
      subtitle={`${CATEGORY_NAME(note.category)} · ${format.dateTime(note.recordedAt)}`}
      expand={{ kind: 'not_built' }}
    />
  )
}

/** Who, when, which shift, and how the resident seemed, as labelled facts. */
function NoteFacts({ note }: { note: CareNote }) {
  const format = useSiteFormat()
  return (
    <dl className={styles.facts} data-note-facts>
      <div className={styles.fact}>
        <dt className={styles.term}>Written by</dt>
        <dd className={styles.value}>{staffLabel(note.recordedBy)}</dd>
      </div>
      <div className={styles.fact}>
        <dt className={styles.term}>When</dt>
        <dd className={styles.value} data-numeric>
          {format.dateTime(note.recordedAt)}
        </dd>
      </div>
      <div className={styles.fact}>
        <dt className={styles.term}>Shift</dt>
        <dd className={styles.value}>{SHIFT_NAMES[note.shift.value]}</dd>
      </div>
      <div className={styles.fact}>
        <dt className={styles.term}>Category</dt>
        <dd className={styles.value}>{CATEGORY_NAME(note.category)}</dd>
      </div>
      <div className={styles.fact}>
        <dt className={styles.term}>Mood</dt>
        <dd className={styles.value}>
          {note.mood.kind === 'recorded' ? (
            MOOD_LABELS[note.mood.score]
          ) : (
            <MoodBadge mood={note.mood} />
          )}
        </dd>
      </div>
    </dl>
  )
}

/**
 * The flag and its review, in full.
 *
 * **Waiting is hatched and a review is quiet.** A second opinion asked for and
 * not given is a gap; one given is a record, and a slow one is a finding about
 * the answer rather than a hole in it, so the wait is stated and not judged.
 */
function SupervisionRecord({ note }: { note: CareNote }) {
  const format = useSiteFormat()
  const review = note.review

  switch (review.kind) {
    case 'not_flagged':
      return (
        <p className={styles.plain} data-supervision="not_flagged">
          Not flagged for review.
        </p>
      )

    case 'flagged_not_reviewed':
      return (
        <dl className={styles.facts} data-supervision="waiting">
          <div className={styles.fact}>
            <dt className={styles.term}>Flagged</dt>
            <dd className={styles.value}>
              {staffLabel(review.flaggedBy)},{' '}
              <span data-numeric>{format.dateTime(review.flaggedAt)}</span>
            </dd>
          </div>
          <div className={styles.fact}>
            <dt className={styles.term}>Reason</dt>
            <dd className={styles.value} data-flag-reason={review.reason.kind}>
              <FlagReasonText reason={review.reason} />
            </dd>
          </div>
          <div className={styles.fact}>
            <dt className={styles.term}>Review</dt>
            <dd className={styles.value}>
              <Unrecorded
                label="Not reviewed"
                detail={`waiting ${waitBetween(review.flaggedAt, now().toISOString() as IsoDateTime)} so far`}
              />
            </dd>
          </div>
        </dl>
      )

    case 'reviewed': {
      const samePerson = review.flaggedBy.id === review.reviewedBy.id
      return (
        <dl className={styles.facts} data-supervision="reviewed">
          <div className={styles.fact}>
            <dt className={styles.term}>Flagged</dt>
            <dd className={styles.value}>
              {staffLabel(review.flaggedBy)},{' '}
              <span data-numeric>{format.dateTime(review.flaggedAt)}</span>
            </dd>
          </div>
          <div className={styles.fact}>
            <dt className={styles.term}>Reason</dt>
            <dd className={styles.value} data-flag-reason={review.reason.kind}>
              <FlagReasonText reason={review.reason} />
            </dd>
          </div>
          <div className={styles.fact}>
            <dt className={styles.term}>Reviewed</dt>
            <dd className={styles.value}>
              {staffLabel(review.reviewedBy)},{' '}
              <span data-numeric>{format.dateTime(review.reviewedAt)}</span>
            </dd>
          </div>
          <div className={styles.fact}>
            <dt className={styles.term}>Action taken</dt>
            <dd className={styles.value} data-review-outcome={review.outcome.kind}>
              {REVIEW_OUTCOME_LABEL(review.outcome)}
            </dd>
          </div>
          <div className={styles.fact}>
            <dt className={styles.term}>Waited</dt>
            <dd className={styles.value}>
              {waitBetween(review.flaggedAt, review.reviewedAt)}
              {samePerson
                ? ', flagged and reviewed by the same person, so no second opinion was given'
                : ''}
            </dd>
          </div>
        </dl>
      )
    }

    default:
      return assertNever(review)
  }
}

function ChainLink({
  relation,
  other,
  data,
}: {
  relation: string
  other: CareNote
  data: 'corrects' | 'corrected-by'
}) {
  const format = useSiteFormat()
  return (
    <li className={styles.chainRow} data-chain={data}>
      <p className={styles.chainRelation}>{relation}</p>
      <p className={styles.chainWho}>
        {staffLabel(other.recordedBy)},{' '}
        <span data-numeric>{format.dateTime(other.recordedAt)}</span>
      </p>
      <p className={styles.body}>{other.body}</p>
      <Link className={styles.openLink} href={noteHref(other.residentId, other.id)}>
        Open that note
        <Icon name={notesIcons.open} size={16} />
      </Link>
    </li>
  )
}
