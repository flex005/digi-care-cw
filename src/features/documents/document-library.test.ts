import { vi } from 'vitest'

/*
 * **Pinned to a full instant before any fixture loads**: 20:20 BST on
 * 16/09/2026. Every expiry is `daysAgo` or `daysAhead` of the fixtures' clock,
 * so these counts are the clock's; a figure written in here is measured at
 * this instant (CLAUDE.md §8).
 */
vi.hoisted(() => {
  window.history.replaceState(null, '', '/documents?at=2026-09-16T19:20:00Z')
})

import { describe, expect, it } from 'vitest'
import type { DocumentRecord, IsoDate, IsoDateTime, StaffRef } from '@/data/types'
import { documentsForSite } from '@/data/fixtures/documents'
import { now } from '@/data/fixtures/clock'
import { staffAkinyemi } from '@/data/fixtures/organisation'
import { zonedDate } from '@/lib/format'
import { DOCUMENT_CATEGORIES } from '@/features/residents/tabs/documents/categories'
import { sharePercent, siteLibrary, withAnExpiryDecision } from './document-library'

const ROSEWOOD = 'site-rosewood-court' as const

/*
 * **From the clock the fixtures were built against, not a date typed here.**
 * Every expiry in the library is `daysAgo` or `daysAhead` of that instant, so
 * a pinned day drifts away from them: this file held 18/09/2026 and on the
 * 22nd a document filed one day ahead of the window had become three days
 * past it, which moved one document from expiring to expired and failed an
 * assertion on a tree nobody had touched. CLAUDE.md §8.
 */
const TODAY: IsoDate = zonedDate(now().toISOString() as IsoDateTime, 'Europe/London')

const document = (
  expiry: DocumentRecord['expiry'],
  category: DocumentRecord['category'] = 'health_clinical',
): DocumentRecord => ({
  id: 'doc-x' as DocumentRecord['id'],
  owner: { kind: 'site', siteId: ROSEWOOD },
  category,
  title: 'A letter',
  file: { kind: 'described', format: 'PDF', bytes: 1 },
  expiry,
  filedBy: staffAkinyemi as StaffRef,
  filedOn: '2026-01-01' as IsoDate,
})

describe('the home’s library', () => {
  /*
   * **DOC-01's figures, and three more documents.** The PRD quotes 237 of 306
   * documents carrying an expiry decision — 77% — and, for the three
   * categories it illustrates: Health and clinical 109 on file, 10 expired, 5
   * expiring, 21 with no expiry recorded; Assessments and care planning
   * 41/5/1/9; Consent records 34/3/3/4. The fixtures produced exactly those
   * until 07/11/2026, when four evening prescriptions were added and three of
   * their scans resolved, all Health and clinical: one with an expiry date, one
   * that does not expire, one with no expiry recorded (docs/DEPARTURES.md).
   * Counted at the pin from the document fixtures without the library: 239 of
   * 309, Health and clinical 112/10/5/22, the other two unchanged.
   */
  it('produces DOC-01’s figures with the three added prescription scans', () => {
    const library = siteLibrary(documentsForSite(ROSEWOOD), TODAY)
    expect(withAnExpiryDecision(library.counts)).toEqual({ decided: 239, total: 309 })
    expect(sharePercent(239, 309)).toBe(77)

    const of = (id: string) =>
      library.categories.find((entry) => entry.id === id)?.counts
    expect(of('health_clinical')).toMatchObject({
      total: 112,
      expired: 10,
      expiring: 5,
      notRecorded: 22,
    })
    expect(of('assessments_care_planning')).toMatchObject({
      total: 41,
      expired: 5,
      expiring: 1,
      notRecorded: 9,
    })
    expect(of('consent_records')).toMatchObject({
      total: 34,
      expired: 3,
      expiring: 3,
      notRecorded: 4,
    })
  })

  it('lists all seven categories, including the empty ones', () => {
    const library = siteLibrary(documentsForSite(ROSEWOOD), TODAY)
    expect([...library.categories.map((entry) => entry.id)].sort()).toEqual(
      [...DOCUMENT_CATEGORIES.map((entry) => entry.id)].sort(),
    )
  })

  /*
   * The order is the finding. Alphabetical, or the order an emergency needs
   * them, would put the same category first every day of the year — which
   * tells a reader nothing they did not know before opening the screen.
   */
  it('orders the categories by what needs attention soonest', () => {
    const library = siteLibrary(documentsForSite(ROSEWOOD), TODAY)
    const urgency = library.categories.map(
      (entry) => entry.counts.expired + entry.counts.expiring,
    )
    expect([...urgency]).toEqual([...urgency].sort((a, b) => b - a))
    // And the head of the list is a category with something wrong in it.
    expect(urgency[0]).toBeGreaterThan(0)
  })

  it('counts each document into exactly one category, and the parts sum to the whole', () => {
    const documents = documentsForSite(ROSEWOOD)
    const library = siteLibrary(documents, TODAY)
    const summed = library.categories.reduce(
      (running, entry) => running + entry.counts.total,
      0,
    )
    expect(summed).toBe(documents.length)
    expect(library.counts.total).toBe(documents.length)
  })
})

/**
 * DOC-01's own rule: a document has an expiry decision if it carries a date,
 * **or** somebody recorded that it does not expire. Where there is neither,
 * nothing can say whether it is still valid — which is a gap, not a milder
 * finding, and it is never added to the expired and expiring counts.
 */
describe('which documents carry an expiry decision', () => {
  it('counts a date and a recorded “does not expire” alike', () => {
    const documents = [
      document({ kind: 'expires', on: '2027-01-01' as IsoDate }),
      document({
        kind: 'does_not_expire',
        decidedBy: staffAkinyemi as StaffRef,
        on: '2026-01-01' as IsoDate,
      }),
      document({ kind: 'not_recorded' }),
    ]
    const library = siteLibrary(documents, TODAY)
    expect(withAnExpiryDecision(library.counts)).toEqual({ decided: 2, total: 3 })
  })

  it('leaves an expired document counted as carrying a decision', () => {
    // Expired is a finding about a document somebody decided on. It is not a gap.
    const library = siteLibrary(
      [document({ kind: 'expires', on: '2020-01-01' as IsoDate })],
      TODAY,
    )
    expect(library.counts.expired).toBe(1)
    expect(withAnExpiryDecision(library.counts)).toEqual({ decided: 1, total: 1 })
  })

  it('never sums the three findings into one number', () => {
    const library = siteLibrary(
      [
        document({ kind: 'expires', on: '2020-01-01' as IsoDate }),
        document({ kind: 'not_recorded' }),
      ],
      TODAY,
    )
    expect(library.counts.expired).toBe(1)
    expect(library.counts.notRecorded).toBe(1)
    expect(withAnExpiryDecision(library.counts).decided).toBe(1)
  })

  it('reports no share at all rather than 100% of nothing', () => {
    expect(sharePercent(0, 0)).toBe(0)
  })
})
