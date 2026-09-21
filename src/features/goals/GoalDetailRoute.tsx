import { useCallback, useId, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import type {
  Goal,
  GoalId,
  GoalProgressNote,
  IsoDateTime,
  Resident,
} from '@/data/types'
import { addGoalProgressNote, getGoalsBySite } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { now } from '@/data/fixtures/clock'
import { useSession, useSignedIn, useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { ActPoint } from '@/components/layout/ActPoint'
import { PageHead } from '@/components/layout/PageHead'
import {
  Button,
  Card,
  CardHead,
  EmptyState,
  buttonClassName,
} from '@/components/primitives'
import { NotYourHome, Unrecorded } from '@/components/status'
import { SubjectStrip } from '@/features/notes/composer/SubjectStrip'
import { pluralise } from '@/lib/format'
import { GoalMeta, GoalStandingBadge, GoalStatement } from './goal-parts'
import styles from './goals.module.css'

/** Said at the act, because GOAL-02's cross-portal note claims a notification. */

/**
 * One goal, and the progress written about it. CW PRD GOAL-02.
 *
 * The sentence: **this is what this person wants, in their words, and here is
 * everything anybody has said about it.**
 *
 * **The subject header is on the screen and does not collapse** (CLAUDE.md §2),
 * and the goal id comes from the route parameter — never from what the queue
 * was showing when somebody tapped.
 *
 * **Adding a note asks the role table about this resident.** Table 3 gives a
 * care worker "Can" and does not say whose residents, so a resident off their
 * list draws the question at the act rather than a yes or a no.
 */
export function GoalDetailRoute() {
  const { activeSite } = useSession()
  const params = useParams<{ goalId: string }>()
  const goalId = params.goalId as GoalId
  const [written, setWritten] = useState(0)
  const [at] = useState(() => now().toISOString() as IsoDateTime)

  const load = useCallback(() => getGoalsBySite(activeSite.id), [activeSite.id])
  const resource = useResource<{
    residents: Resident[]
    goals: Goal[]
    progress: GoalProgressNote[]
  }>(load, [activeSite.id, written])

  if (resource.kind === 'refused') return <NotYourHome refusal={resource} />

  if (resource.kind === 'loading')
    return (
      <div className={styles.page}>
        <Card>
          <p className={styles.status} role="status">
            Loading the goal…
          </p>
        </Card>
      </div>
    )

  if (resource.kind === 'error')
    return (
      <div className={styles.page}>
        <Card>
          <EmptyState
            title="The goal could not be loaded"
            body="Nothing has been lost: this is a read."
            actions={
              <Button variant="secondary" onClick={resource.retry}>
                Try again
              </Button>
            }
          />
        </Card>
      </div>
    )

  const goal = resource.data.goals.find((entry) => entry.id === goalId)
  const resident = resource.data.residents.find(
    (entry) => entry.id === goal?.residentId,
  )

  if (goal === undefined || resident === undefined)
    return (
      <div className={styles.page}>
        <Card>
          <EmptyState
            title="That goal is not at this home"
            body="It may belong to another home, or the address may be wrong."
            actions={
              <Link href="/goals" className={buttonClassName({ variant: 'secondary' })}>
                Back to goals
              </Link>
            }
          />
        </Card>
      </div>
    )

  const notes = resource.data.progress.filter((note) => note.goalId === goal.id)

  return (
    <Detail
      goal={goal}
      resident={resident}
      notes={notes}
      at={at}
      onWritten={() => setWritten((count) => count + 1)}
    />
  )
}

function Detail({
  goal,
  resident,
  notes,
  at,
  onWritten,
}: {
  goal: Goal
  resident: Resident
  notes: GoalProgressNote[]
  at: IsoDateTime
  onWritten: () => void
}) {
  const { activeSite } = useSession()
  const format = useSiteFormat()

  return (
    <div className={styles.page}>
      <PageHead
        title={`${resident.preferredName}’s goal`}
        lines={[activeSite.name, `set by ${goal.setBy.displayName}`]}
        action={
          <Link href="/goals" className={buttonClassName({ variant: 'secondary' })}>
            Back to goals
          </Link>
        }
      />

      <Card>
        <SubjectStrip resident={resident} site={activeSite} />
        <div className={styles.hero}>
          <GoalStatement goal={goal} hero />
          <p className={styles.setBy}>
            Set by {goal.setBy.displayName} ·{' '}
            <span data-numeric>{format.date(goal.setOn)}</span>
          </p>
          <GoalMeta goal={goal} now={at} />
          <GoalStandingBadge goal={goal} notes={notes} now={at} />
        </div>

        <div className={styles.field}>
          <p className={styles.fieldLabel}>How anybody will know it has happened</p>
          <p className={styles.fieldBody}>{goal.howWeWillKnow}</p>
        </div>
      </Card>

      <Card>
        <CardHead
          title="Progress"
          subtitle={
            notes.length === 0
              ? 'Nothing has been written about this goal yet.'
              : `${pluralise(notes.length, 'note')}, oldest first.`
          }
          expand={{ kind: 'whole' }}
        />

        {notes.length === 0 ? (
          <Unrecorded
            variant="panel"
            label="No progress notes yet"
            detail="nobody has written about this goal since it was set — be the first to record progress"
          />
        ) : (
          <ol className={styles.timeline}>
            {[...notes]
              .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
              .map((note) => (
                <li key={note.id} className={styles.note} data-progress-note={note.id}>
                  <p className={styles.noteMeta}>
                    {format.attribution(note.recordedBy.displayName, note.recordedAt)}
                  </p>
                  <p className={styles.noteBody}>{note.body}</p>
                </li>
              ))}
          </ol>
        )}

        <ProgressNoteForm goal={goal} resident={resident} onWritten={onWritten} />
      </Card>
    </div>
  )
}

/**
 * Adding a progress note.
 *
 * **Immutable once written**, like a care note: there is no edit and no delete,
 * because it is somebody's account of a moment.
 *
 * **It does not change the goal's status.** Marking a goal achieved is a
 * manager's decision, and a note that quietly closed one would be this screen
 * taking it.
 */
function ProgressNoteForm({
  goal,
  resident,
  onWritten,
}: {
  goal: Goal
  resident: Resident
  onWritten: () => void
}) {
  const { member } = useSignedIn()
  const viewer = useViewer()
  const id = useId()
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const answer = viewer.ask('add_goal_progress_note', resident.id)

  const submit = () => {
    addGoalProgressNote({
      goalId: goal.id,
      body,
      by: member.ref,
      at: now().toISOString() as IsoDateTime,
    })
      .then(() => {
        setBody('')
        setError('')
        setDone(
          `Added to ${resident.fullLegalName}’s goal, in your name, and held in this session only.`,
        )
        onWritten()
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Nothing was recorded.'),
      )
  }

  return (
    <div className={styles.progressForm} data-progress-form>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={`${id}-note`}>
          Add a progress note
        </label>
        <textarea
          id={`${id}-note`}
          className={styles.textarea}
          rows={4}
          placeholder="What happened, and what it looked like for them."
          value={body}
          onChange={(event) => setBody(event.target.value)}
          disabled={answer.kind !== 'yes'}
          data-progress-body
        />
        <span className={styles.fieldHint}>
          It goes on the record in your name and cannot be edited afterwards.
        </span>
      </div>

      {answer.kind === 'yes' ? (
        <Button
          size="large"
          disabled={body.trim() === ''}
          onClick={submit}
          data-add-progress-note
        >
          {`Add this note to ${resident.preferredName}’s goal`}
        </Button>
      ) : (
        /*
         * Not a refusal notice: where the PRD does not say whether this role
         * may write about a resident off their list, the question is drawn at
         * the act and the control stays unavailable rather than guessing
         * either way. Kept while the "nothing is sent" notices went.
         */
        <ActPoint
          answer={answer}
          label="Add a progress note"
          notBuilt="Adding a progress note is not built."
          residentName={resident.preferredName}
        />
      )}

      {done === '' ? null : (
        <p className={styles.done} role="status" data-progress-done>
          {done}
        </p>
      )}
      {error === '' ? null : (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
