import type { IsoDate, Resident, RiskTemplateId } from '@/data/types'
import { RISK_ASSESSMENT_TEMPLATES } from '@/data/types'
import { configuredState, countsTowardsExpected } from '@/data/access/site-config-store'

/**
 * Every risk assessment this home is expected to hold, and what it holds.
 * CW PRD RA-01.
 *
 * **A row is a template against a resident, not an assessment.** 28 residents
 * and 9 templates is 252 rows whether or not anybody has ever opened one, which
 * is the whole point of the screen: a list built from the assessments that
 * exist would show a home that has done everything it has done, and say nothing
 * about the 78 nobody has looked at.
 *
 * **Never assessed is not low risk**, which is RA-01's own copy and the reason
 * the default tab is the gap rather than the list.
 *
 * Counted over what this home asks: a retired template is not a gap anybody
 * here can close, and it leaves the denominator as it does on the resident's
 * own tab.
 */

export type RiskStanding =
  /** Nobody has ever assessed this risk for this person. */
  | { kind: 'never_assessed' }
  /** Assessed, and the review date has passed. */
  | { kind: 'review_overdue'; dueOn: IsoDate; daysOverdue: number }
  /** Assessed, and the review is due now. */
  | { kind: 'review_due'; dueOn: IsoDate }
  /**
   * Assessed, and nobody has set a date for the next review.
   *
   * **Its own member, and in no tab but All.** RA-01's tabs are Never assessed,
   * Review overdue and Review due; a review nobody has scheduled has not passed
   * a date, so putting it under "overdue" would claim a deadline that was never
   * set. It is counted and named under the second card instead, so it is not a
   * state a reader can only find by scrolling.
   */
  | { kind: 'no_review_date' }
  /** Assessed and the review is in date, or was completed. */
  | { kind: 'in_date' }

export interface RiskRow {
  resident: Resident
  templateId: RiskTemplateId
  templateName: string
  standing: RiskStanding
}

export function standingOf(
  resident: Resident,
  templateId: RiskTemplateId,
): RiskStanding {
  const status = resident.risks[templateId]
  if (status.kind === 'not_assessed') return { kind: 'never_assessed' }
  const review = status.reviewState
  switch (review.kind) {
    case 'overdue':
      return {
        kind: 'review_overdue',
        dueOn: review.dueOn,
        daysOverdue: review.daysOverdue,
      }
    case 'due':
      return { kind: 'review_due', dueOn: review.dueOn }
    case 'never_scheduled':
      return { kind: 'no_review_date' }
    default:
      return { kind: 'in_date' }
  }
}

/** Every expected row at a home, unsorted. */
export function rowsFor(residents: Resident[]): RiskRow[] {
  return residents.flatMap((resident) =>
    RISK_ASSESSMENT_TEMPLATES.filter((template) =>
      countsTowardsExpected(
        configuredState(
          resident.siteId,
          template.id,
          resident.risks[template.id].kind === 'assessed',
        ),
      ),
    ).map((template) => ({
      resident,
      templateId: template.id,
      templateName: template.name,
      standing: standingOf(resident, template.id),
    })),
  )
}

export type RiskView = 'never_assessed' | 'review_overdue' | 'review_due' | 'all'

export const RISK_VIEWS: { id: RiskView; label: string }[] = [
  { id: 'never_assessed', label: 'Never assessed' },
  { id: 'review_overdue', label: 'Review overdue' },
  { id: 'review_due', label: 'Review due' },
  { id: 'all', label: 'All' },
]

export function ofView(rows: RiskRow[], view: RiskView): RiskRow[] {
  if (view === 'all') return rows
  return rows.filter((row) => row.standing.kind === view)
}

/**
 * RA-01's order: **never assessed first, then longest overdue.**
 *
 * A risk nobody has looked at outranks one somebody assessed and has not
 * revisited, however long ago: the second has a judgement on the record and the
 * first has nothing. Within the overdue, longest first — the wait is the
 * finding. Everything else keeps the residents' own order, so a reader
 * scanning All sees the home rather than a shuffle.
 */
const RANK: Record<RiskStanding['kind'], number> = {
  never_assessed: 0,
  review_overdue: 1,
  review_due: 2,
  no_review_date: 3,
  in_date: 4,
}

export function inReadingOrder(rows: RiskRow[]): RiskRow[] {
  return [...rows].sort((a, b) => {
    const rank = RANK[a.standing.kind] - RANK[b.standing.kind]
    if (rank !== 0) return rank
    if (a.standing.kind === 'review_overdue' && b.standing.kind === 'review_overdue')
      return b.standing.daysOverdue - a.standing.daysOverdue
    return 0
  })
}

/** How many rows are in each state, for the cards and the tabs. */
export function countBy(rows: RiskRow[]): Record<RiskStanding['kind'], number> {
  const counts: Record<RiskStanding['kind'], number> = {
    never_assessed: 0,
    review_overdue: 0,
    review_due: 0,
    no_review_date: 0,
    in_date: 0,
  }
  for (const row of rows) counts[row.standing.kind] += 1
  return counts
}

/** RA-01's exact copy, which has to appear on the page. */
export const NEVER_ASSESSED_IS_NOT_LOW_RISK = 'Never assessed is not low risk.'
