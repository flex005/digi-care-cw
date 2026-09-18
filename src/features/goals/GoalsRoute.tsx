import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import type { Goal, GoalProgressNote, IsoDateTime, Resident } from '@/data/types'
import { getGoalsBySite } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { now } from '@/data/fixtures/clock'
import { useSession } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { ActionCard } from '@/components/layout/ActionCard'
import { ActPoint } from '@/components/layout/ActPoint'
import { PageHead } from '@/components/layout/PageHead'
import {
  Button,
  Card,
  CardHead,
  EmptyState,
  Pager,
  SelectedMark,
  buttonClassName,
  usePaged,
} from '@/components/primitives'
import { NotYourHome } from '@/components/status'
import { formatCount, pluralise } from '@/lib/format'
import { GoalMeta, GoalStandingBadge, GoalStatement } from './goal-parts'
import {
  GOAL_VIEWS,
  byLongestWait,
  inView,
  summarise,
  type GoalRow,
  type GoalViewId,
} from './goal-views'
import styles from './goals.module.css'

/** The exclusion GOAL-01 states out loud, and the reason it is stated. */
export const noDateLine = (count: number): string =>
  `${count} have no date at all: a goal with no date is not late and is not counted here.`

/**
 * The goals queue. CW PRD GOAL-01.
 *
 * The sentence: **these goals passed their date and nobody has said what
 * happened.** Longest past its date first, because the wait is the finding.
 *
 * **The queue is the home's**, as GOAL-01's card counts it ("across 40 at
 * Rosewood Court"), and the act is asked of the role table resident by
 * resident. The care notes list is the other way round because CN-01 counts
 * over the viewer's own residents; each screen follows its own words.
 *
 * **A goal is always in the resident's voice.** The statement is the largest
 * thing on the row, in quotation marks, and nothing paraphrases it.
 */
export function GoalsRoute() {
  const { activeSite } = useSession()
  const viewer = useViewer()
  const [view, setView] = useState<GoalViewId>('past_target')
  const [at] = useState(() => now().toISOString() as IsoDateTime)

  const load = useCallback(() => getGoalsBySite(activeSite.id), [activeSite.id])
  const resource = useResource<{
    residents: Resident[]
    goals: Goal[]
    progress: GoalProgressNote[]
  }>(load, [activeSite.id])

  const head = (
    <PageHead
      title="Goals"
      lines={[activeSite.name, 'every goal at this home, in the resident’s words']}
    />
  )

  if (resource.kind === 'refused') return <NotYourHome refusal={resource} />

  if (resource.kind === 'loading')
    return (
      <div className={styles.page}>
        {head}
        <Card>
          <p className={styles.status} role="status">
            Loading goals…
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
            title="The goals could not be loaded"
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

  return (
    <Queue
      head={head}
      data={resource.data}
      siteName={activeSite.name}
      at={at}
      view={view}
      onView={setView}
      setOrCloseAnswer={viewer.ask('set_or_close_goal')}
    />
  )
}

function Queue({
  head,
  data,
  siteName,
  at,
  view,
  onView,
  setOrCloseAnswer,
}: {
  head: React.ReactNode
  data: { residents: Resident[]; goals: Goal[]; progress: GoalProgressNote[] }
  siteName: string
  at: IsoDateTime
  view: GoalViewId
  onView: (next: GoalViewId) => void
  setOrCloseAnswer: ReturnType<ReturnType<typeof useViewer>['ask']>
}) {
  const rows: GoalRow[] = useMemo(() => {
    const byId = new Map(data.residents.map((resident) => [resident.id, resident]))
    return data.goals.flatMap((goal) => {
      const resident = byId.get(goal.residentId)
      if (resident === undefined) return []
      return [
        {
          goal,
          resident,
          notes: data.progress.filter((note) => note.goalId === goal.id),
        },
      ]
    })
  }, [data])

  const summary = summarise(rows, at)
  const shown = byLongestWait(rows.filter((row) => inView(row, view, at)))
  const paged = usePaged(shown, 10)
  const label = GOAL_VIEWS.find((entry) => entry.id === view)?.label ?? ''

  return (
    <div className={styles.page}>
      {head}

      <ActionCard
        kicker="Past their date, nothing said"
        figure={formatCount(summary.pastTarget)}
        of={`of ${pluralise(summary.withTargetDate, 'goal')} with a target date, across ${summary.total} at ${siteName}`}
        detail={
          <div className={styles.bannerDetail} data-goals-banner>
            <p>Nobody has said what happened.</p>
            <p data-no-date>{noDateLine(summary.noTargetDate)}</p>
          </div>
        }
        footLabel="Read in this order"
        footValue="Longest past its date first"
        action={
          summary.pastTarget === 0 ? (
            <span className={styles.bannerQuiet}>
              Every goal with a date has had something said about it
            </span>
          ) : (
            <button
              type="button"
              className={buttonClassName({ variant: 'secondary' })}
              onClick={() => onView('past_target')}
              data-show-past-target
            >
              Show the {summary.pastTarget} waiting
            </button>
          )
        }
      />

      {/*
       * The act this screen does not hold, drawn once with the role table's
       * words rather than on every row: setting, closing and marking a goal
       * achieved are a manager's, and a reader should know the act exists.
       */}
      <Card>
        <CardHead
          title="Changing a goal’s status"
          subtitle="Open, closed and achieved are somebody else's decision. Drawn here so the record shows whose."
          expand={{ kind: 'whole' }}
        />
        <div className={styles.acts}>
          <ActPoint
            answer={setOrCloseAnswer}
            label="Set or close a goal"
            notBuilt="Setting and closing goals is not built."
          />
        </div>
      </Card>

      <Card>
        <CardHead
          title="Goals"
          subtitle="Longest past its date first: the wait is the finding."
          expand={{ kind: 'whole' }}
        />

        <div className={styles.pills} role="group" aria-label="Goals view">
          {GOAL_VIEWS.map((entry) => {
            const chosen = entry.id === view
            const count = rows.filter((row) => inView(row, entry.id, at)).length
            return (
              <button
                key={entry.id}
                type="button"
                className={chosen ? styles.pillChosen : styles.pill}
                aria-pressed={chosen}
                onClick={() => onView(entry.id)}
                data-goal-view={entry.id}
              >
                <SelectedMark selected={chosen} />
                <span data-numeric>
                  {entry.label} · {formatCount(count)}
                </span>
              </button>
            )
          })}
        </div>

        <p className={styles.claim} data-goals-claim>
          <span data-numeric>
            {shown.length} of {rows.length}
          </span>{' '}
          {rows.length === 1 ? 'goal' : 'goals'} at {siteName} · {label.toLowerCase()}
        </p>

        {shown.length === 0 ? (
          <p className={styles.empty}>
            No goal at {siteName} is in this view. The views above reach the rest.
          </p>
        ) : (
          <>
            <ul className={styles.rows}>
              {paged.shown.map((row) => (
                <li key={row.goal.id} className={styles.row} data-goal={row.goal.id}>
                  <div className={styles.rowWho}>
                    <p className={styles.rowName}>{row.resident.preferredName}</p>
                    <p className={styles.rowMeta}>
                      {row.resident.fullLegalName}
                      {row.resident.room.kind === 'recorded'
                        ? ` · Room ${row.resident.room.value}`
                        : ' · Room not recorded'}
                    </p>
                  </div>

                  <div className={styles.rowMain}>
                    <GoalStatement goal={row.goal} />
                    <p className={styles.rowMeta}>
                      set by {row.goal.setBy.displayName}
                    </p>
                    <GoalMeta goal={row.goal} now={at} />
                    <GoalStandingBadge goal={row.goal} notes={row.notes} now={at} />
                  </div>

                  <div className={styles.rowAct}>
                    <Link
                      href={`/goals/${row.goal.id}`}
                      className={buttonClassName({ variant: 'secondary' })}
                      data-open-goal={row.goal.id}
                    >
                      Open
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
            <Pager paged={paged} total={shown.length} noun="goals" />
          </>
        )}
      </Card>
    </div>
  )
}
