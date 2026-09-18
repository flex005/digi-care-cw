import { useCallback, useState } from 'react'
import Link from 'next/link'
import type { Activity, IsoDate, IsoDateTime, Resident } from '@/data/types'
import { getActivities } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { now } from '@/data/fixtures/clock'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { ActionCard } from '@/components/layout/ActionCard'
import { ActPoint } from '@/components/layout/ActPoint'
import { PageHead } from '@/components/layout/PageHead'
import {
  Button,
  Card,
  CardHead,
  EmptyState,
  SegmentedControl,
  buttonClassName,
} from '@/components/primitives'
import { NotYourHome, Settled, Unrecorded } from '@/components/status'
import { formatCount, formatDate, pluralise, zonedDate } from '@/lib/format'
import {
  WEEKDAYS,
  countsOf,
  mondayOf,
  sessionState,
  sessionsInWeek,
  summariseWeek,
  weekDates,
} from './activity-week'
import styles from './activities.module.css'

/** The exclusion ACT-01 states out loud, worded once. */
export const invitedLine = (residents: number): string =>
  `${residents} ${residents === 1 ? 'resident was' : 'residents were'} invited to them, and there is no record of whether any of them came.`

/**
 * The activities calendar. CW PRD ACT-01.
 *
 * The sentence: **these sessions happened and nobody recorded who came.**
 *
 * **The week, Monday to Sunday, in the home's clock.** A session at 09:00 in
 * London belongs to that London day whoever is reading it. Week and list are
 * two presentations of the same seven days, so they are a segmented control;
 * the weeks either side are navigation, so they are not.
 *
 * **A planned session that is over with nothing recorded wears the unrecorded
 * treatment**, because that is exactly what it is: nobody wrote down who came.
 * A session still ahead is drawn plainly — nothing is missing from it yet.
 */
export function ActivitiesRoute() {
  const { activeSite } = useSession()
  const viewer = useViewer()
  const [at] = useState(() => now().toISOString() as IsoDateTime)
  const [weeks, setWeeks] = useState(0)
  const [presentation, setPresentation] = useState<'calendar' | 'list'>('calendar')

  const load = useCallback(() => getActivities(activeSite.id), [activeSite.id])
  const resource = useResource<{ activities: Activity[]; residents: Resident[] }>(
    load,
    [activeSite.id],
  )

  const head = (
    <PageHead
      title="Activities"
      lines={[activeSite.name, 'what is planned, and who came']}
    />
  )

  if (resource.kind === 'refused') return <NotYourHome refusal={resource} />

  if (resource.kind === 'loading')
    return (
      <div className={styles.page}>
        {head}
        <Card>
          <p className={styles.status} role="status">
            Loading activities…
          </p>
        </Card>
      </div>
    )

  if (resource.kind === 'error')
    return (
      <div className={styles.page}>
        {head}
        <Card>
          <EmptyState
            title="The activities could not be loaded"
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

  const monday = mondayOf(at, activeSite.timeZone, weeks)
  const week = sessionsInWeek(resource.data.activities, monday, activeSite.timeZone)
  const summary = summariseWeek(week, at)
  const createAnswer = viewer.ask('create_activity_session')

  return (
    <div className={styles.page}>
      {head}

      <ActionCard
        kicker={weeks === 0 ? 'This week' : `Week of ${formatDate(monday)}`}
        figure={formatCount(summary.happenedWithNoRecord)}
        of={`of ${pluralise(summary.sessions, 'session')} at ${activeSite.name} this week happened with nobody recorded`}
        detail={
          <div className={styles.bannerDetail} data-activities-banner>
            <p>{invitedLine(summary.residentsInvited)}</p>
          </div>
        }
        footLabel="Week beginning"
        footValue={formatDate(monday)}
        action={
          summary.happenedWithNoRecord === 0 ? (
            <span className={styles.bannerQuiet}>
              Every session that has happened has been written up
            </span>
          ) : (
            <button
              type="button"
              className={buttonClassName({ variant: 'secondary' })}
              onClick={() => setPresentation('list')}
              data-show-sessions
            >
              Show the {summary.happenedWithNoRecord} in a list
            </button>
          )
        }
      />

      {/*
       * Creating, editing and cancelling a session are drawn once, with the
       * role table's answer, rather than on every card.
       */}
      <Card>
        <CardHead
          title="Planning sessions"
          subtitle="Who may create, change or cancel a session, and whether this build does it yet."
          expand={{ kind: 'whole' }}
        />
        <div className={styles.acts}>
          <ActPoint
            answer={createAnswer}
            label="Create a session"
            notBuilt="Planning, editing and cancelling sessions are not built in this product: a senior carer may, and the Admin build is where it is done."
          />
        </div>
      </Card>

      <Card>
        <div className={styles.weekHead}>
          <CardHead
            title="The week"
            subtitle="Monday to Sunday, in this home’s clock."
            expand={{ kind: 'whole' }}
          />
          <div className={styles.weekControls}>
            <div className={styles.weekNav} role="group" aria-label="Which week">
              <Button
                variant="secondary"
                onClick={() => setWeeks((count) => count - 1)}
                data-week-back
              >
                Week before
              </Button>
              <Button
                variant="secondary"
                disabled={weeks === 0}
                onClick={() => setWeeks(0)}
                data-week-now
              >
                This week
              </Button>
              <Button
                variant="secondary"
                onClick={() => setWeeks((count) => count + 1)}
                data-week-next
              >
                Week after
              </Button>
            </div>
            {/* One set of sessions, two presentations: a segmented control. */}
            <SegmentedControl
              label="How to show the week"
              value={presentation}
              onValueChange={(value: string) =>
                setPresentation(value === 'list' ? 'list' : 'calendar')
              }
              options={[
                { value: 'calendar', label: 'Calendar' },
                { value: 'list', label: 'List' },
              ]}
            />
          </div>
        </div>

        <p className={styles.claim} data-activities-claim>
          <span data-numeric>{pluralise(week.length, 'session')}</span> in the week
          beginning <span data-numeric>{formatDate(monday)}</span> at {activeSite.name}
        </p>

        {week.length === 0 ? (
          <p className={styles.empty}>
            No session is planned at {activeSite.name} in this week.
          </p>
        ) : presentation === 'calendar' ? (
          <Week monday={monday} sessions={week} at={at} />
        ) : (
          <ul className={styles.list}>
            {week.map((activity) => (
              <li key={activity.id} className={styles.listRow}>
                <SessionCard activity={activity} at={at} inList />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

/** Seven columns, each holding the sessions of one day. */
function Week({
  monday,
  sessions,
  at,
}: {
  monday: IsoDate
  sessions: Activity[]
  at: IsoDateTime
}) {
  const { activeSite } = useSession()
  const days = weekDates(monday)

  return (
    <div className={styles.week} data-week={monday}>
      {days.map((date, index) => {
        const ofDay = sessions.filter(
          (activity) => zonedDate(activity.startsAt, activeSite.timeZone) === date,
        )
        return (
          <div key={date} className={styles.day} data-day={date}>
            <p className={styles.dayHead}>
              <span className={styles.dayName}>{WEEKDAYS[index]}</span>
              <span className={styles.dayDate} data-numeric>
                {formatDate(date)}
              </span>
            </p>
            {ofDay.length === 0 ? (
              // Stated, not blank: nothing was planned, which is a fact about
              // the day rather than a column nobody filled in.
              <p className={styles.dayEmpty}>Nothing planned</p>
            ) : (
              ofDay.map((activity) => (
                <SessionCard key={activity.id} activity={activity} at={at} />
              ))
            )}
          </div>
        )
      })}
      <p className={styles.weekNote}>Times are {activeSite.name}’s.</p>
    </div>
  )
}

/**
 * One session on the calendar.
 *
 * The three states ACT-01 names, drawn as what they are: over with nothing
 * recorded takes the unrecorded treatment, part-recorded says both halves as
 * separate facts, and a session still ahead is plain.
 */
function SessionCard({
  activity,
  at,
  inList = false,
}: {
  activity: Activity
  at: IsoDateTime
  inList?: boolean
}) {
  const format = useSiteFormat()
  const counts = countsOf(activity)
  const state = sessionState(activity, at)

  return (
    <Link
      href={`/activities/${activity.id}`}
      className={inList ? styles.sessionRow : styles.session}
      data-session={activity.id}
      data-session-state={state.kind}
    >
      <span className={styles.sessionName}>{activity.name}</span>
      <span className={styles.sessionMeta} data-numeric>
        {format.time(activity.startsAt)} · {activity.place}
      </span>
      <span className={styles.sessionFacts}>
        {state.kind === 'cancelled' ? (
          <Settled
            label="Cancelled"
            detail={
              activity.standing.kind === 'cancelled' ? activity.standing.reason : ''
            }
          />
        ) : null}
        {state.kind === 'happened_nothing_recorded' ? (
          <Unrecorded
            variant="chip"
            label="Nobody recorded who came"
            detail={`${pluralise(counts.invited, 'resident')} invited`}
          />
        ) : null}
        {state.kind === 'part_recorded' ? (
          <>
            <Settled label={`${counts.recorded} of ${counts.invited} recorded`} />
            <Unrecorded
              variant="chip"
              label={`${state.notRecorded} not recorded`}
              detail="nobody has said whether they came"
            />
          </>
        ) : null}
        {state.kind === 'all_recorded' ? (
          <Settled
            label={`All ${counts.invited} recorded`}
            detail={`${counts.attended} attended · ${counts.didNotAttend} did not`}
          />
        ) : null}
        {state.kind === 'ahead' ? (
          <span className={styles.plannedWords}>
            Planned · <span data-numeric>{pluralise(counts.invited, 'resident')}</span>{' '}
            invited
          </span>
        ) : null}
      </span>
    </Link>
  )
}
