import type { Goal, GoalProgressNote, IsoDateTime, Resident } from '@/data/types'
import { goalStanding } from './goal-timing'

/**
 * The five views GOAL-01 puts on the queue, and what each one counts over.
 *
 * Pure, and exported on its own: the rule is the thing under test rather than
 * the wiring.
 */

export type GoalViewId =
  'past_target' | 'open' | 'closed' | 'resident_not_asked' | 'all'

export interface GoalRow {
  goal: Goal
  resident: Resident
  notes: GoalProgressNote[]
}

export const GOAL_VIEWS: { id: GoalViewId; label: string }[] = [
  { id: 'past_target', label: 'Past date, nothing said' },
  { id: 'open', label: 'Open' },
  { id: 'closed', label: 'Closed' },
  { id: 'resident_not_asked', label: 'Resident not asked' },
  { id: 'all', label: 'All' },
]

export function inView(row: GoalRow, view: GoalViewId, now: IsoDateTime): boolean {
  const standing = goalStanding(row.goal, row.notes, now)
  switch (view) {
    case 'past_target':
      return standing.kind === 'past_target'
    case 'open':
      return row.goal.outcome.kind === 'open'
    case 'closed':
      return row.goal.outcome.kind !== 'open'
    /*
     * A compliance finding, not a gap in the record: somebody decided about
     * this person's goal and nobody put it to them. Only a closed goal can be
     * in it — an open goal has no closure to have asked about, which is the
     * type saying so rather than a screen deciding it.
     */
    case 'resident_not_asked':
      return standing.kind === 'closed' && standing.residentView !== 'not_applicable'
        ? standing.residentView.kind === 'not_asked'
        : false
    case 'all':
      return true
  }
}

/**
 * Longest past its date first, because the wait is the finding (GOAL-01).
 *
 * Goals with no date sort after the dated ones rather than being dropped: a
 * goal with no date is not late, and it is not absent either.
 */
export function byLongestWait(rows: GoalRow[]): GoalRow[] {
  return [...rows].sort((a, b) => {
    const left = a.goal.target.kind === 'by_date' ? a.goal.target.on : '￿'
    const right = b.goal.target.kind === 'by_date' ? b.goal.target.on : '￿'
    return left.localeCompare(right) || a.goal.setOn.localeCompare(b.goal.setOn)
  })
}

/**
 * GOAL-01's summary card, with the exclusion it states out loud.
 *
 * **The denominator is goals with a target date, not every goal**, because a
 * goal with no date can never be past one — counting it in would make the
 * figure smaller for a reason that has nothing to do with anybody's work. The
 * goals with no date are stated beside it rather than left out silently.
 */
export interface GoalSummary {
  pastTarget: number
  withTargetDate: number
  total: number
  noTargetDate: number
}

export function summarise(rows: GoalRow[], now: IsoDateTime): GoalSummary {
  return {
    pastTarget: rows.filter(
      (row) => goalStanding(row.goal, row.notes, now).kind === 'past_target',
    ).length,
    withTargetDate: rows.filter((row) => row.goal.target.kind === 'by_date').length,
    total: rows.length,
    noTargetDate: rows.filter((row) => row.goal.target.kind === 'no_target_date')
      .length,
  }
}
