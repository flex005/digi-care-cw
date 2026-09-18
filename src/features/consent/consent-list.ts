import type { AnyConsent, ConsentTypeId, Resident } from '@/data/types'
import { CONSENT_TYPES } from '@/data/types'
import { configuredState, countsTowardsExpected } from '@/data/access/site-config-store'

/**
 * Every consent decision this home is expected to hold, and what it holds.
 * CW PRD CON-01.
 *
 * **Every resident against every consent type**, which is CON-01's own
 * sub-text: 28 residents and 8 types is 224 rows, and the ones nobody has
 * sought are the reason the screen exists.
 *
 * **Never sought is not refusal and it is not permission** — CON-01's exact
 * copy, which has to appear verbatim, and the sentence the whole product is
 * built around. A reader who takes an absent consent for a given one acts
 * without it.
 *
 * **Decided-for-them is its own column, not a shade of given.** A
 * best-interests decision and an attorney's decision are lawful and they are
 * not the resident agreeing; CON-01 separates them for that reason, and so
 * does the decision authority on the record.
 */

export type ConsentStanding =
  /** Nobody has asked, and nobody has decided on their behalf. */
  | { kind: 'never_sought' }
  /** Sought, and no answer recorded. */
  | { kind: 'awaiting' }
  /** The resident said no. */
  | { kind: 'refused' }
  /** A best-interests decision or an attorney, whichever way it went. */
  | { kind: 'decided_for_them'; how: 'best_interests' | 'lpa_holder' }
  /** The resident decided, and said yes. */
  | { kind: 'given_by_them' }
  /** Given once and taken back. */
  | { kind: 'withdrawn' }

export interface ConsentRow {
  resident: Resident
  typeId: ConsentTypeId
  typeName: string
  standing: ConsentStanding
}

export function standingOf(status: AnyConsent): ConsentStanding {
  switch (status.kind) {
    case 'not_sought':
      return { kind: 'never_sought' }
    case 'pending':
      return { kind: 'awaiting' }
    case 'withdrawn':
      return { kind: 'withdrawn' }
    case 'refused':
    case 'given':
      /*
       * **Who decided outranks what was decided, for this list.** A refusal an
       * attorney entered and a refusal the resident spoke are different facts,
       * and CON-01's "Decided for them" tab is about the first. The Refused tab
       * is the resident saying no.
       */
      if (status.by.kind !== 'the_resident')
        return { kind: 'decided_for_them', how: status.by.kind }
      return status.kind === 'refused' ? { kind: 'refused' } : { kind: 'given_by_them' }
  }
}

export function rowsFor(residents: Resident[]): ConsentRow[] {
  return residents.flatMap((resident) =>
    CONSENT_TYPES.filter((type) => {
      const status = resident.consents[type.id] as AnyConsent
      return countsTowardsExpected(
        configuredState(resident.siteId, type.id, status.kind !== 'not_sought'),
      )
    }).map((type) => ({
      resident,
      typeId: type.id,
      typeName: type.name,
      standing: standingOf(resident.consents[type.id] as AnyConsent),
    })),
  )
}

export type ConsentView =
  'never_sought' | 'awaiting' | 'refused' | 'decided_for_them' | 'all'

export const CONSENT_VIEWS: { id: ConsentView; label: string }[] = [
  { id: 'never_sought', label: 'Never sought' },
  { id: 'awaiting', label: 'Awaiting a decision' },
  { id: 'refused', label: 'Refused' },
  { id: 'decided_for_them', label: 'Decided for them' },
  { id: 'all', label: 'All' },
]

export function ofView(rows: ConsentRow[], view: ConsentView): ConsentRow[] {
  if (view === 'all') return rows
  return rows.filter((row) => row.standing.kind === view)
}

/**
 * How many decisions were made for somebody rather than by them.
 *
 * CON-01 leads on this figure in a paragraph of its own, and the reason is
 * that it is lawful and it is not the same thing. The count is over decisions
 * that were made, never over every row: a consent nobody sought was not made
 * for anybody either.
 */
export function madeForThem(rows: ConsentRow[]): { forThem: number; decided: number } {
  const decided = rows.filter(
    (row) => row.standing.kind !== 'never_sought' && row.standing.kind !== 'awaiting',
  )
  return {
    forThem: decided.filter((row) => row.standing.kind === 'decided_for_them').length,
    decided: decided.length,
  }
}

export function countBy(rows: ConsentRow[]): Record<ConsentStanding['kind'], number> {
  const counts: Record<ConsentStanding['kind'], number> = {
    never_sought: 0,
    awaiting: 0,
    refused: 0,
    decided_for_them: 0,
    given_by_them: 0,
    withdrawn: 0,
  }
  for (const row of rows) counts[row.standing.kind] += 1
  return counts
}

/** CON-01's exact copy, which has to appear verbatim. */
export const NEVER_SOUGHT_IS_NOT =
  'Never sought is not refusal and it is not permission.'

/** What each tab's state means, in CON-01's own words. */
export const STANDING_MEANS: Record<ConsentStanding['kind'], string> = {
  never_sought: 'nobody has asked, and nobody has decided on their behalf',
  awaiting: 'sought but no answer recorded',
  refused: 'the resident said no',
  decided_for_them: 'a best-interests decision or an attorney',
  given_by_them: 'the resident agreed',
  withdrawn: 'given once and taken back',
}
