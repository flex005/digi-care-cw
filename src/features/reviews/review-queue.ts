import type {
  CarePlanDomainRecord,
  CarePlanReviewState,
  IsoDate,
  Resident,
} from '@/data/types'
import { CARE_PLAN_DOMAINS } from '@/data/types'
import { assertNever } from '@/lib/assert-never'

/**
 * Who is owed a whole care plan review, and how long they have waited.
 *
 * Pure, so the queue's order — the finding on this screen — is testable
 * without a screen.
 */

export type ReviewStanding =
  | { kind: 'overdue'; dueOn: IsoDate; daysOverdue: number }
  | { kind: 'due'; dueOn: IsoDate }
  | { kind: 'scheduled'; dueOn: IsoDate }
  /** Nobody has ever set a date. Not "not due": nobody decided when. */
  | { kind: 'never_scheduled' }
  | { kind: 'completed'; on: IsoDate; nextDueOn: IsoDate; outstanding: number }

export function standingOf(state: CarePlanReviewState): ReviewStanding {
  switch (state.kind) {
    case 'overdue':
      return { kind: 'overdue', dueOn: state.dueOn, daysOverdue: state.daysOverdue }
    case 'due':
      return { kind: 'due', dueOn: state.dueOn }
    case 'scheduled':
      return { kind: 'scheduled', dueOn: state.dueOn }
    case 'never_scheduled':
      return { kind: 'never_scheduled' }
    case 'completed':
      return {
        kind: 'completed',
        on: state.completedOn,
        nextDueOn: state.nextDueOn,
        outstanding:
          state.outstanding.kind === 'outstanding'
            ? state.outstanding.domains.length
            : 0,
      }
    default:
      return assertNever(state)
  }
}

/**
 * Whether this person is owed one now.
 *
 * **Never scheduled counts as owed.** Nobody deciding when a review is due is
 * not the same as one not being due, and a queue that left them out would make
 * the person nobody has planned for the person nobody sees.
 */
export const isOwed = (standing: ReviewStanding): boolean =>
  standing.kind === 'overdue' ||
  standing.kind === 'due' ||
  standing.kind === 'never_scheduled'

export interface ReviewRow {
  resident: Resident
  standing: ReviewStanding
}

/**
 * Longest overdue first, then due, then the people nobody has scheduled.
 *
 * **Never scheduled sorts last among the owed rather than being dropped**: it
 * is owed, and it has no date to rank by, so it is named at the end instead of
 * given an invented position.
 */
export function byLongestOverdue(rows: ReviewRow[]): ReviewRow[] {
  const rank = (row: ReviewRow) =>
    row.standing.kind === 'overdue'
      ? 0
      : row.standing.kind === 'due'
        ? 1
        : row.standing.kind === 'never_scheduled'
          ? 2
          : 3
  return [...rows].sort((a, b) => {
    const order = rank(a) - rank(b)
    if (order !== 0) return order
    const left = a.standing.kind === 'overdue' ? -a.standing.daysOverdue : 0
    const right = b.standing.kind === 'overdue' ? -b.standing.daysOverdue : 0
    return (
      left - right || a.resident.fullLegalName.localeCompare(b.resident.fullLegalName)
    )
  })
}

/**
 * A domain that would be carried onto the signature as a gap.
 *
 * Anything but a complete, in-date domain: never written, started and never
 * signed, or past its own review date.
 */
export const isGap = (record: CarePlanDomainRecord | undefined): boolean =>
  record === undefined || record.status.kind !== 'complete'

/** Why a domain is a gap, in the words the signature carries. */
export function gapWords(record: CarePlanDomainRecord | undefined): string {
  if (record === undefined) return 'not on this care plan'
  switch (record.status.kind) {
    case 'not_started':
      return 'never written'
    case 'in_progress':
      return 'started and never signed'
    case 'review_due':
      return 'past its own review date'
    case 'complete':
      return 'in date'
    default:
      return assertNever(record.status)
  }
}

/** Every domain the home keeps, with what the plan holds for it. */
export function domainRows(resident: Resident) {
  const byDomain = new Map(
    resident.carePlan.map((entry) => [entry.domainId, entry] as const),
  )
  return CARE_PLAN_DOMAINS.map((domain) => ({
    domain,
    record: byDomain.get(domain.id),
  }))
}
