import type { DocumentCategoryId, DocumentRecord, IsoDate } from '@/data/types'
import { DOCUMENT_CATEGORIES } from '@/features/residents/tabs/documents/categories'
import {
  countExpiry,
  type ExpiryCounts,
} from '@/features/residents/tabs/documents/expiry'

/**
 * Everything on file at a home, by category. CW PRD DOC-01.
 *
 * **A document has an expiry decision if it carries a date, or somebody
 * recorded that it does not expire.** Where there is neither, nothing can tell
 * a reader whether the document is still valid — which is DOC-01's own rule and
 * the reason the lead figure is a coverage figure rather than a count of
 * expired ones.
 *
 * **Expired, expiring and no-expiry-recorded are never summed.** The first two
 * are findings about a document whose validity somebody decided; the third is
 * the absence of the fact they are made of. A single "needs attention" total
 * would weigh a lapsed DNAR and a photograph nobody has classified the same.
 * `countExpiry` already owns that distinction for a resident's library, and
 * this reads it rather than counting again.
 */

export interface CategorySummary {
  id: DocumentCategoryId
  label: string
  holds: string
  counts: ExpiryCounts
}

export interface SiteLibrary {
  /** All seven categories, always, ordered by what needs attention soonest. */
  categories: CategorySummary[]
  /** Every document at the home: the residents' and the home's own. */
  counts: ExpiryCounts
}

/**
 * **Ordered by urgency, never alphabetically or by filing order**, because the
 * order is the finding. The order an emergency needs them is the right order
 * for one resident's library, where a reader is looking for a document they
 * can name; it is the wrong order here, where nobody is looking for a
 * category — they are looking for what has gone out of date. Alphabetical
 * would put Assessments first every day of the year, which tells a reader
 * nothing they did not know before opening the screen.
 *
 * Expired and expiring decide it together, because both are findings about a
 * date somebody recorded. What nobody has decided breaks the tie, and the
 * label breaks that, so the order is stable from one load to the next.
 */
export function siteLibrary(documents: DocumentRecord[], today: IsoDate): SiteLibrary {
  const categories = DOCUMENT_CATEGORIES.map((category) => ({
    id: category.id,
    label: category.label,
    holds: category.holds,
    counts: countExpiry(
      documents.filter((document) => document.category === category.id),
      today,
    ),
  }))

  return {
    categories: categories.sort((a, b) => {
      const urgency =
        b.counts.expired + b.counts.expiring - (a.counts.expired + a.counts.expiring)
      if (urgency !== 0) return urgency
      if (b.counts.notRecorded !== a.counts.notRecorded)
        return b.counts.notRecorded - a.counts.notRecorded
      return a.label.localeCompare(b.label)
    }),
    counts: countExpiry(documents, today),
  }
}

/**
 * How many documents carry an expiry decision, and out of how many.
 *
 * Derived from the same counts the rows render, so the headline and the
 * categories under it cannot disagree — the two-clocks failure, which is what
 * happens when a total and its parts are counted separately.
 */
export function withAnExpiryDecision(counts: ExpiryCounts): {
  decided: number
  total: number
} {
  return { decided: counts.total - counts.notRecorded, total: counts.total }
}

/**
 * The share, rounded, with its parts alongside it.
 *
 * **Never returned alone.** A percentage with no denominator is the figure this
 * product refuses; the caller is handed both and `AggregateFigure` makes it
 * state the relation.
 */
export function sharePercent(decided: number, total: number): number {
  return total === 0 ? 0 : Math.round((decided / total) * 100)
}

/** DOC-01's own explanation of what the coverage figure is made of. */
export const EXPIRY_DECISION_MEANS =
  'Either a date, or somebody recording that the document does not expire. Where there is neither, nothing can tell you whether the document is still valid.'

/** What the hatched count on a category row says. */
export const NO_EXPIRY_RECORDED = 'nobody has said whether these expire'
