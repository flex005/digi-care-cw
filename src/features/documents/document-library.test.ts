import { describe, expect, it } from 'vitest'
import type { DocumentRecord, IsoDate, StaffRef } from '@/data/types'
import { documentsForSite } from '@/data/fixtures/documents'
import { staffAkinyemi } from '@/data/fixtures/organisation'
import { DOCUMENT_CATEGORIES } from '@/features/residents/tabs/documents/categories'
import { sharePercent, siteLibrary, withAnExpiryDecision } from './document-library'

const ROSEWOOD = 'site-rosewood-court' as const
const TODAY = '2026-09-18' as IsoDate

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
   * **DOC-01's own figures.** The PRD quotes 237 of 306 documents carrying an
   * expiry decision — 77% — and, for the three categories it illustrates:
   * Health and clinical 109 on file, 10 expired, 5 expiring, 21 with no expiry
   * recorded; Assessments and care planning 41/5/1/9; Consent records 34/3/3/4.
   * The fixtures produce exactly those.
   */
  it('produces the exact figures DOC-01 quotes', () => {
    const library = siteLibrary(documentsForSite(ROSEWOOD), TODAY)
    expect(withAnExpiryDecision(library.counts)).toEqual({ decided: 237, total: 306 })
    expect(sharePercent(237, 306)).toBe(77)

    const of = (id: string) =>
      library.categories.find((entry) => entry.id === id)?.counts
    expect(of('health_clinical')).toMatchObject({
      total: 109,
      expired: 10,
      expiring: 5,
      notRecorded: 21,
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
    expect(library.categories.map((entry) => entry.id)).toEqual(
      DOCUMENT_CATEGORIES.map((entry) => entry.id),
    )
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
