import { useCallback, useState } from 'react'
import Link from 'next/link'
import type { Goal, GoalProgressNote, IsoDateTime } from '@/data/types'
import { getResidentGoals } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { now } from '@/data/fixtures/clock'
import { Card, CardHead, buttonClassName } from '@/components/primitives'
import { Unrecorded } from '@/components/status'
import { pluralise } from '@/lib/format'
import { useOpenRecord } from '@/features/residents/profile/ProfileContext'
import { GoalMeta, GoalStandingBadge, GoalStatement } from './goal-parts'
import { byLongestWait } from './goal-views'
import styles from './goals.module.css'

/**
 * One resident's goals, on their record. CW PRD GOAL-01 and GOAL-02, scoped to
 * the person whose record is open.
 *
 * **Nobody has set a goal with this person is a finding**, not an empty list,
 * and it is drawn as one.
 */
export function GoalsTab() {
  const { resident } = useOpenRecord()
  const [at] = useState(() => now().toISOString() as IsoDateTime)

  const load = useCallback(() => getResidentGoals(resident.id), [resident.id])
  const resource = useResource<{ goals: Goal[]; progress: GoalProgressNote[] }>(load, [
    resident.id,
  ])

  if (resource.kind === 'loading')
    return (
      <Card>
        <p className={styles.status} role="status">
          Loading goals…
        </p>
      </Card>
    )

  if (resource.kind === 'refused' || resource.kind === 'error')
    return (
      <Card>
        <p className={styles.formError} role="alert">
          {resource.kind === 'refused'
            ? 'This record is not yours to open.'
            : 'The goals could not be loaded. Nothing has been lost: this is a read.'}
        </p>
      </Card>
    )

  const rows = byLongestWait(
    resource.data.goals.map((goal) => ({
      goal,
      resident,
      notes: resource.data.progress.filter((note) => note.goalId === goal.id),
    })),
  )

  return (
    <Card>
      <CardHead
        title={`${resident.preferredName}’s goals`}
        subtitle={
          rows.length === 0
            ? 'In their own words, when somebody has set one with them.'
            : `${pluralise(rows.length, 'goal')}, longest past its date first.`
        }
        expand={{ kind: 'link', href: '/goals' }}
      />

      {rows.length === 0 ? (
        <Unrecorded
          variant="panel"
          label="Nobody has set a goal with this person"
          detail="not an empty list: no goal has been agreed with them and written down"
        />
      ) : (
        <ul className={styles.rows}>
          {rows.map((row) => (
            <li key={row.goal.id} className={styles.row} data-goal={row.goal.id}>
              <div className={styles.rowMain}>
                <GoalStatement goal={row.goal} />
                <p className={styles.rowMeta}>set by {row.goal.setBy.displayName}</p>
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
      )}
    </Card>
  )
}
