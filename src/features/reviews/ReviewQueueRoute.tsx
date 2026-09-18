import { useCallback, useState } from 'react'
import Link from 'next/link'
import type { Resident } from '@/data/types'
import { getResidentsBySite } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
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
  SelectedMark,
  buttonClassName,
} from '@/components/primitives'
import { NotYourHome, Settled, Unrecorded } from '@/components/status'
import { assertNever } from '@/lib/assert-never'
import { formatCount, formatLateness, pluralise } from '@/lib/format'
import {
  byLongestOverdue,
  isOwed,
  standingOf,
  type ReviewRow,
  type ReviewStanding,
} from './review-queue'
import styles from './reviews.module.css'

/** What the queue counts over, said once. */
export const COUNTED_LINE =
  'Counted over every resident at this home, whether or not anybody has set a review date for them.'

/**
 * Who is owed a whole care plan review. Table 3: "Reviews — conduct", senior
 * carers, and the CW PRD draws no screen for it.
 *
 * The sentence: **these care plans are past their review date, and nobody has
 * sat down over them.**
 *
 * **Never scheduled is in the queue, not outside it.** Nobody deciding when a
 * review is due is not the same as one not being due, and leaving those people
 * out would make the person nobody has planned for the person nobody sees.
 */
export function ReviewQueueRoute() {
  const { activeSite } = useSession()
  const viewer = useViewer()
  const [view, setView] = useState<'owed' | 'all'>('owed')

  const load = useCallback(() => getResidentsBySite(activeSite.id), [activeSite.id])
  const resource = useResource<Resident[]>(load, [activeSite.id])

  const head = (
    <PageHead
      title="Care plan reviews"
      lines={[activeSite.name, 'who is owed one, longest overdue first']}
    />
  )

  if (resource.kind === 'refused') return <NotYourHome refusal={resource} />

  if (resource.kind === 'loading')
    return (
      <div className={styles.page}>
        {head}
        <Card>
          <p className={styles.status} role="status">
            Loading the reviews…
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
            title="The reviews could not be loaded"
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

  const rows: ReviewRow[] = resource.data.map((resident) => ({
    resident,
    standing: standingOf(resident.carePlanReview),
  }))
  const owed = rows.filter((row) => isOwed(row.standing))
  const shown = byLongestOverdue(view === 'owed' ? owed : rows)
  const conductAnswer = viewer.ask('conduct_review')

  return (
    <div className={styles.page}>
      {head}

      <ActionCard
        kicker="Owed a whole care plan review"
        figure={formatCount(owed.length)}
        of={`of ${pluralise(rows.length, 'resident')} at ${activeSite.name}`}
        detail={
          <div className={styles.bannerDetail} data-reviews-banner>
            <p>{COUNTED_LINE}</p>
            <p>
              {formatCount(
                owed.filter((row) => row.standing.kind === 'never_scheduled').length,
              )}{' '}
              of them have no review date at all: nobody has decided when one is due,
              which is not the same as one not being due.
            </p>
          </div>
        }
        footLabel="Read in this order"
        footValue="Longest overdue first"
        action={
          owed.length === 0 ? (
            <span className={styles.bannerQuiet}>
              Every care plan here has a review in date
            </span>
          ) : (
            <button
              type="button"
              className={buttonClassName({ variant: 'secondary' })}
              onClick={() => setView('owed')}
              data-show-owed
            >
              Show the {owed.length} owed
            </button>
          )
        }
      />

      {conductAnswer.kind === 'yes' ? null : (
        <Card>
          <CardHead
            title="Conducting a review"
            subtitle="Who may sit down over a whole care plan, and record that they did."
            expand={{ kind: 'whole' }}
          />
          <div className={styles.acts}>
            <ActPoint
              answer={conductAnswer}
              label="Complete a review"
              notBuilt="Completing a review is not built."
            />
          </div>
        </Card>
      )}

      <Card>
        <CardHead
          title="Residents"
          subtitle={COUNTED_LINE}
          expand={{ kind: 'whole' }}
        />

        <div className={styles.pills} role="group" aria-label="Which residents">
          {(
            [
              { id: 'owed', label: 'Owed a review', count: owed.length },
              { id: 'all', label: 'Everybody', count: rows.length },
            ] as const
          ).map((entry) => {
            const chosen = entry.id === view
            return (
              <button
                key={entry.id}
                type="button"
                className={chosen ? styles.pillChosen : styles.pill}
                aria-pressed={chosen}
                onClick={() => setView(entry.id)}
                data-review-view={entry.id}
              >
                <SelectedMark selected={chosen} />
                <span data-numeric>
                  {entry.label} · {formatCount(entry.count)}
                </span>
              </button>
            )
          })}
        </div>

        <p className={styles.claim} data-reviews-claim>
          <span data-numeric>
            {shown.length} of {rows.length}
          </span>{' '}
          {rows.length === 1 ? 'resident' : 'residents'} at {activeSite.name}
        </p>

        {shown.length === 0 ? (
          <p className={styles.empty}>
            Nobody at {activeSite.name} is owed a whole care plan review.
          </p>
        ) : (
          <ul className={styles.rows}>
            {shown.map(({ resident, standing }) => (
              <li
                key={resident.id}
                className={styles.row}
                data-review-for={resident.id}
              >
                <div className={styles.rowWho}>
                  <p className={styles.rowName}>{resident.preferredName}</p>
                  <p className={styles.rowMeta}>
                    {resident.fullLegalName}
                    {resident.room.kind === 'recorded'
                      ? ` · Room ${resident.room.value}`
                      : ' · Room not recorded'}
                  </p>
                </div>
                <div className={styles.rowState}>
                  <Standing standing={standing} />
                </div>
                {conductAnswer.kind === 'yes' ? (
                  <div className={styles.rowAct}>
                    <Link
                      href={`/residents/${resident.id}/care-plan/review`}
                      className={buttonClassName({ variant: 'secondary' })}
                      data-open-review={resident.id}
                    >
                      Open the review
                    </Link>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

/** Where a resident's review has got to. Never a blank, and never a guess. */
function Standing({ standing }: { standing: ReviewStanding }) {
  const format = useSiteFormat()

  switch (standing.kind) {
    case 'overdue':
      return (
        <Unrecorded
          variant="chip"
          label={`${formatLateness(standing.daysOverdue)} past its review date`}
          detail={`due ${format.date(standing.dueOn)}, and nobody has sat down over it`}
        />
      )
    case 'due':
      return (
        <Unrecorded
          variant="chip"
          label="Due today"
          detail={`due ${format.date(standing.dueOn)}`}
        />
      )
    case 'never_scheduled':
      return (
        <Unrecorded
          variant="chip"
          label="No review date"
          detail="nobody has decided when one is due, which is not the same as one not being due"
        />
      )
    case 'scheduled':
      return <Settled label={`Due ${format.date(standing.dueOn)}`} />
    case 'completed':
      return (
        <Settled
          label={`Reviewed ${format.date(standing.on)}`}
          detail={
            standing.outstanding === 0
              ? `nothing outstanding · next due ${format.date(standing.nextDueOn)}`
              : `${pluralise(standing.outstanding, 'domain')} outstanding at the time · next due ${format.date(standing.nextDueOn)}`
          }
        />
      )
    default:
      return assertNever(standing)
  }
}
