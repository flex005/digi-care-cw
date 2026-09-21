import { useCallback, useId, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import type {
  Activity,
  ActivityId,
  AttendanceState,
  DidNotAttendReasonId,
  IsoDateTime,
  Resident,
  ResidentId,
} from '@/data/types'
import { DID_NOT_ATTEND_REASONS } from '@/data/types'
import { getActivity, recordActivityAttendance } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { now } from '@/data/fixtures/clock'
import { useSession, useSignedIn, useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { ActPoint } from '@/components/layout/ActPoint'
import { PageHead } from '@/components/layout/PageHead'
import {
  Avatar,
  Button,
  Card,
  CardHead,
  EmptyState,
  Select,
  SelectedMark,
  buttonClassName,
} from '@/components/primitives'
import { NotYourHome, Settled, Unrecorded } from '@/components/status'
import { assertNever } from '@/lib/assert-never'
import { pluralise } from '@/lib/format'
import { countsOf } from './activity-week'
import styles from './activities.module.css'

type Answer =
  | { kind: 'unanswered' }
  | { kind: 'attended' }
  | {
      kind: 'did_not_attend'
      reason: DidNotAttendReasonId | 'not_chosen'
      note: string
    }

const UNANSWERED: Answer = { kind: 'unanswered' }

/**
 * One session, and who came. CW PRD ACT-02.
 *
 * The sentence: **these people were invited, and this is who came.**
 *
 * **Every row carries its own resident's identity** (CLAUDE.md §2 applied per
 * row). The failure this module invites is not picking the wrong person from a
 * list, it is slipping a row on a grid and marking Doris present while Beryl is
 * marked absent, so each row names the person it is about and the confirmation
 * counts what it is about to write.
 *
 * **Nobody is answered for.** A resident left alone keeps `not_recorded`, which
 * is the gap the calendar counts: recording six of fourteen leaves eight saying
 * nobody wrote them down, never eight saying nobody came.
 *
 * **A "did not attend" needs a reason**, for the same reason a not-given dose
 * does: without one it cannot be told from nobody having looked.
 */
export function AttendanceRoute() {
  const { activeSite } = useSession()
  const params = useParams<{ activityId: string }>()
  const activityId = params.activityId as ActivityId
  const [written, setWritten] = useState(0)

  const load = useCallback(() => getActivity(activityId), [activityId])
  const resource = useResource<{ activity: Activity; residents: Resident[] }>(load, [
    activityId,
    written,
  ])

  if (resource.kind === 'refused') return <NotYourHome refusal={resource} />

  if (resource.kind === 'loading')
    return (
      <div className={styles.page}>
        <Card>
          <p className={styles.status} role="status">
            Loading the session…
          </p>
        </Card>
      </div>
    )

  if (resource.kind === 'error')
    return (
      <div className={styles.page}>
        <Card>
          <EmptyState
            title="The session could not be loaded"
            body="Nothing has been lost: this is a read."
            actions={
              <Link
                href="/activities"
                className={buttonClassName({ variant: 'secondary' })}
              >
                Back to activities
              </Link>
            }
          />
        </Card>
      </div>
    )

  if (resource.data.activity.siteId !== activeSite.id)
    return (
      <div className={styles.page}>
        <Card>
          <EmptyState
            title="That session is at another home"
            body="Switch home from the header to open it."
            actions={
              <Link
                href="/activities"
                className={buttonClassName({ variant: 'secondary' })}
              >
                Back to activities
              </Link>
            }
          />
        </Card>
      </div>
    )

  return (
    <Session
      activity={resource.data.activity}
      residents={resource.data.residents}
      onRecorded={() => setWritten((count) => count + 1)}
    />
  )
}

function Session({
  activity,
  residents,
  onRecorded,
}: {
  activity: Activity
  residents: Resident[]
  onRecorded: () => void
}) {
  const { activeSite } = useSession()
  const { member } = useSignedIn()
  const format = useSiteFormat()
  const id = useId()

  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [sessionNote, setSessionNote] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const counts = countsOf(activity)
  const answerOf = (residentId: string) => answers[residentId] ?? UNANSWERED
  const chosen = activity.invited.filter(
    (entry) => answerOf(entry.residentId).kind !== 'unanswered',
  )
  const waiting = chosen.filter((entry) => {
    const answer = answerOf(entry.residentId)
    return answer.kind === 'did_not_attend' && answer.reason === 'not_chosen'
  })
  const ready = chosen.length > 0 && waiting.length === 0

  const submit = () => {
    const at = now().toISOString() as IsoDateTime
    type Written = { residentId: ResidentId; attendance: AttendanceState }
    const written: Written[] = chosen.flatMap((entry): Written[] => {
      const answer = answerOf(entry.residentId)
      if (answer.kind === 'attended')
        return [
          {
            residentId: entry.residentId,
            attendance: {
              kind: 'attended' as const,
              recordedBy: member.ref,
              recordedAt: at,
            },
          },
        ]
      if (answer.kind === 'did_not_attend' && answer.reason !== 'not_chosen')
        return [
          {
            residentId: entry.residentId,
            attendance: {
              kind: 'did_not_attend' as const,
              reason: answer.reason,
              note: answer.note.trim(),
              recordedBy: member.ref,
              recordedAt: at,
            },
          },
        ]
      return []
    })

    recordActivityAttendance({
      activityId: activity.id,
      answers: written,
      by: member.ref,
    })
      .then((count) => {
        setAnswers({})
        setError('')
        setDone(
          `${pluralise(count, 'answer')} recorded for ${activity.name}, in your name and held in this session only.`,
        )
        onRecorded()
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Nothing was recorded.'),
      )
  }

  return (
    <div className={styles.page}>
      <PageHead
        title={activity.name}
        lines={[
          activeSite.name,
          `${format.dateTime(activity.startsAt)} to ${format.time(activity.endsAt)}`,
          activity.place,
        ]}
        action={
          <Link
            href="/activities"
            className={buttonClassName({ variant: 'secondary' })}
          >
            Back to activities
          </Link>
        }
      />

      <Card>
        <CardHead
          title="This session"
          subtitle={`Planned by ${activity.plannedBy.displayName}. ${activity.description}`}
          expand={{ kind: 'whole' }}
        />
        <div className={styles.sessionFacts}>
          <Settled
            label={`${counts.recorded} of ${counts.invited} recorded`}
            detail={`${counts.attended} attended · ${counts.didNotAttend} did not`}
          />
          {counts.notRecorded === 0 ? null : (
            <Unrecorded
              variant="chip"
              label={`${counts.notRecorded} not recorded`}
              detail="nobody has said whether they came"
            />
          )}
          {activity.standing.kind === 'cancelled' ? (
            <Settled
              label="Cancelled"
              detail={`${activity.standing.reason} · ${format.attribution(
                activity.standing.by.displayName,
                activity.standing.at,
              )}`}
            />
          ) : null}
        </div>
        {activity.standing.kind === 'cancelled' ? (
          <p className={styles.note}>
            Attendance already recorded stays on the record: somebody wrote it down with
            their name and the time on it, and cancelling the session does not make that
            untrue.
          </p>
        ) : null}
      </Card>

      {done === '' ? null : (
        <p className={styles.done} role="status" data-attendance-done>
          {done}
        </p>
      )}

      <Card>
        <CardHead
          title="Who came"
          subtitle="Everybody invited, whether or not anybody has answered for them. Nobody is answered for by leaving them alone."
          expand={{ kind: 'whole' }}
        />

        <ul className={styles.attendance}>
          {activity.invited.map((entry) => {
            const resident = residents.find((person) => person.id === entry.residentId)
            if (resident === undefined) return null
            return (
              <AttendanceRow
                key={entry.residentId}
                resident={resident}
                recorded={entry.attendance}
                answer={answerOf(entry.residentId)}
                onAnswer={(next) =>
                  setAnswers((current) => ({ ...current, [entry.residentId]: next }))
                }
              />
            )
          })}
        </ul>

        {activity.joined.length === 0 ? null : (
          <div className={styles.joined}>
            <p className={styles.fieldLabel}>
              {pluralise(activity.joined.length, 'person', 'people')} joined without
              being invited
            </p>
            <p className={styles.note}>
              They are not in the figures above: the denominator is the invitation list,
              and adding them to it would rewrite the plan to say they were expected.
            </p>
            <ul className={styles.joinedList}>
              {activity.joined.map((joiner) => {
                const resident = residents.find(
                  (person) => person.id === joiner.residentId,
                )
                return (
                  <li key={joiner.residentId} className={styles.joinedRow}>
                    <span className={styles.rowName}>
                      {resident?.fullLegalName ?? joiner.residentId}
                    </span>
                    <span className={styles.rowMeta}>
                      {joiner.note} ·{' '}
                      {format.attribution(
                        joiner.recordedBy.displayName,
                        joiner.recordedAt,
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={`${id}-session-note`}>
            Notes about this session overall
          </label>
          <textarea
            id={`${id}-session-note`}
            className={styles.textarea}
            rows={3}
            value={sessionNote}
            onChange={(event) => setSessionNote(event.target.value)}
            data-session-note
          />
        </div>

        <div className={styles.foot}>
          {chosen.length === 0 ? (
            <p className={styles.footState} data-attendance-waiting>
              Nothing is answered yet. Whoever you do not answer for stays recorded as
              nobody having said.
            </p>
          ) : (
            <p className={styles.footState} data-attendance-waiting>
              {waiting.length === 0 ? (
                <>
                  <strong>{pluralise(chosen.length, 'answer')} ready to record</strong>{' '}
                  of {counts.invited} invited.
                </>
              ) : (
                <>
                  <strong>Waiting on:</strong> a reason for{' '}
                  {waiting
                    .map((entry) => {
                      const resident = residents.find(
                        (person) => person.id === entry.residentId,
                      )
                      return resident?.preferredName ?? entry.residentId
                    })
                    .join(', ')}
                </>
              )}
            </p>
          )}

          <AttendanceAct
            residents={residents}
            activity={activity}
            ready={ready}
            onSubmit={submit}
          />

          {error === '' ? null : (
            <p className={styles.formError} role="alert">
              {error}
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}

/**
 * The act, asked of the role table over the residents this session names.
 *
 * Table 3 gives a care worker "Can" and does not say whose residents, and a
 * session is a room full of people rather than one subject — so the question is
 * asked for each invited resident and drawn once, naming the people it is
 * unanswered for. A care worker whose list covers everybody invited records
 * normally.
 */
function AttendanceAct({
  residents,
  activity,
  ready,
  onSubmit,
}: {
  residents: Resident[]
  activity: Activity
  ready: boolean
  onSubmit: () => void
}) {
  const viewer = useViewer()
  const answers = activity.invited.map((entry) => ({
    residentId: entry.residentId,
    answer: viewer.ask('record_attendance', entry.residentId),
  }))
  const unanswered = answers.filter((entry) => entry.answer.kind !== 'yes')
  const first = unanswered[0]

  if (first !== undefined) {
    const named = unanswered
      .map((entry) => {
        const resident = residents.find((person) => person.id === entry.residentId)
        return resident?.preferredName ?? entry.residentId
      })
      .join(', ')
    return (
      <div className={styles.actRefused}>
        <ActPoint
          answer={first.answer}
          label="Record attendance"
          notBuilt="Recording attendance is not built."
          residentName={named}
        />
        <p className={styles.note}>
          {unanswered.length} of {activity.invited.length} invited are outside what the
          PRD settles for you: {named}.
        </p>
      </div>
    )
  }

  return (
    <Button size="large" disabled={!ready} onClick={onSubmit} data-record-attendance>
      Record attendance
    </Button>
  )
}

/** One invited resident: what the record says, and what is being recorded now. */
function AttendanceRow({
  resident,
  recorded,
  answer,
  onAnswer,
}: {
  resident: Resident
  recorded: AttendanceState
  answer: Answer
  onAnswer: (next: Answer) => void
}) {
  return (
    <li className={styles.attendanceRow} data-attendance-for={resident.id}>
      <div className={styles.rowWho}>
        <Avatar photo={resident.photo} name={resident.fullLegalName} size="small" />
        <div>
          <p className={styles.rowName}>{resident.preferredName}</p>
          <p className={styles.rowMeta}>
            {resident.fullLegalName}
            {resident.room.kind === 'recorded'
              ? ` · Room ${resident.room.value}`
              : ' · Room not recorded'}
          </p>
        </div>
      </div>

      <div className={styles.rowState}>
        <RecordedAttendance state={recorded} />
      </div>

      {recorded.kind === 'not_recorded' ? (
        <div className={styles.rowAnswer}>
          <div
            className={styles.answers}
            role="group"
            aria-label={`Did ${resident.fullLegalName} come?`}
          >
            <button
              type="button"
              className={
                answer.kind === 'attended' ? styles.answerChosen : styles.answer
              }
              aria-pressed={answer.kind === 'attended'}
              onClick={() => onAnswer({ kind: 'attended' })}
              data-answer="attended"
            >
              <SelectedMark selected={answer.kind === 'attended'} />
              Attended
            </button>
            <button
              type="button"
              className={
                answer.kind === 'did_not_attend' ? styles.answerChosen : styles.answer
              }
              aria-pressed={answer.kind === 'did_not_attend'}
              onClick={() =>
                onAnswer({ kind: 'did_not_attend', reason: 'not_chosen', note: '' })
              }
              data-answer="did_not_attend"
            >
              <SelectedMark selected={answer.kind === 'did_not_attend'} />
              Did not attend
            </button>
          </div>

          {answer.kind === 'did_not_attend' ? (
            <div className={styles.answerDetail}>
              <Select
                labelVisible
                label={`Why did ${resident.preferredName} not come?`}
                placeholder="Choose a reason"
                value={answer.reason === 'not_chosen' ? undefined : answer.reason}
                onValueChange={(value) =>
                  onAnswer({ ...answer, reason: value as DidNotAttendReasonId })
                }
                options={DID_NOT_ATTEND_REASONS.map((entry) => ({
                  value: entry.id,
                  label: entry.name,
                }))}
              />
              {answer.reason === 'other' ? (
                <input
                  className={styles.input}
                  value={answer.note}
                  placeholder="Say why"
                  onChange={(event) =>
                    onAnswer({ ...answer, note: event.target.value })
                  }
                  aria-label={`Why ${resident.preferredName} did not come`}
                  data-did-not-attend-note
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

/** What the record already says about this person, never an empty column. */
function RecordedAttendance({ state }: { state: AttendanceState }) {
  const format = useSiteFormat()

  switch (state.kind) {
    case 'not_recorded':
      return <Unrecorded variant="chip" label="Nobody has said" />
    case 'attended':
      return (
        <Settled
          label="Attended"
          detail={format.attribution(state.recordedBy.displayName, state.recordedAt)}
        />
      )
    case 'did_not_attend':
      return (
        <Settled
          label={`Did not attend: ${
            DID_NOT_ATTEND_REASONS.find((entry) => entry.id === state.reason)?.name ??
            state.reason
          }`}
          detail={[
            state.note,
            format.attribution(state.recordedBy.displayName, state.recordedAt),
          ]
            .filter((part) => part !== '')
            .join(' · ')}
        />
      )
    default:
      return assertNever(state)
  }
}
