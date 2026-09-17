import type { IsoDateTime } from '@/data/types'
import type { Omission } from '@/data/access/client'
import { fellDueAt, type MarRecord } from '@/data/fixtures/medications'

/**
 * What the omissions list counts and how it narrows. Pure, so a test asserts the
 * figures rather than the hour the suite runs.
 */

/** Seven days back from the record's moment: "this week". */
export const RANGE_DAYS = 7

export const weekBefore = (moment: IsoDateTime): IsoDateTime =>
  new Date(
    new Date(moment).getTime() - RANGE_DAYS * 86_400_000,
  ).toISOString() as IsoDateTime

export type EscalationFilter = 'all' | 'escalated' | 'not_escalated'
export type ClosureFilter = 'open_and_closed' | 'open' | 'closed'

export const ESCALATION_FILTERS: { id: EscalationFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'escalated', label: 'Escalated' },
  { id: 'not_escalated', label: 'Not escalated' },
]

/**
 * **"Open and closed" is a third pill, not the absence of a choice.** Closing
 * an omission leaves it on All and moves it between Open and Closed, so a list
 * showing both has to be something a reader can choose and see chosen.
 */
export const CLOSURE_FILTERS: { id: ClosureFilter; label: string }[] = [
  { id: 'open_and_closed', label: 'Open and closed' },
  { id: 'open', label: 'Open' },
  { id: 'closed', label: 'Closed' },
]

export const isEscalated = (omission: Omission): boolean =>
  omission.escalatedAt !== 'not_escalated'

export const isClosed = (omission: Omission): boolean =>
  omission.closure.kind === 'closed'

export function filterOmissions(
  omissions: Omission[],
  escalation: EscalationFilter,
  closure: ClosureFilter,
): Omission[] {
  return omissions.filter((omission) => {
    const byEscalation =
      escalation === 'all' ||
      (escalation === 'escalated' ? isEscalated(omission) : !isEscalated(omission))
    const byClosure =
      closure === 'open_and_closed' ||
      (closure === 'closed' ? isClosed(omission) : !isClosed(omission))
    return byEscalation && byClosure
  })
}

/**
 * The words a filtered count is a count of. **The filter is in the claim**: a
 * figure above a narrowed list is otherwise a claim about a set the reader is
 * not looking at.
 */
export function filterWords(
  escalation: EscalationFilter,
  closure: ClosureFilter,
): string {
  const parts = [
    escalation === 'escalated'
      ? 'escalated'
      : escalation === 'not_escalated'
        ? 'not escalated'
        : '',
    closure === 'open' ? 'open' : closure === 'closed' ? 'closed' : '',
  ].filter((part) => part !== '')
  return parts.length === 0 ? '' : `, ${parts.join(' and ')}`
}

/**
 * Doses that fell due in the week, over the MAR records given. The same
 * derivation `getOmissions` uses for its home-wide figure (`fellDueAt`, and the
 * same floor), applied to the viewer's residents' records, so the denominator
 * and the omissions are counted over one population.
 */
export function dosesDueSince(records: MarRecord[], since: IsoDateTime): number {
  const floor = new Date(since).getTime()
  return records.filter((record) => {
    const when = fellDueAt(record)
    return when !== 'not_due' && new Date(when).getTime() >= floor
  }).length
}

/** The open omission that has waited longest, or that none is open. */
export function oldestOpen(omissions: Omission[]): Omission | 'none' {
  const open = omissions
    .filter((omission) => !isClosed(omission))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
  return open[0] ?? 'none'
}
