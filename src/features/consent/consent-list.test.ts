import { describe, expect, it } from 'vitest'
import type { AnyConsent, IsoDate } from '@/data/types'
import { CONSENT_TYPES } from '@/data/types'
import { residentsBySite } from '@/data/fixtures/residents'
import { staffAkinyemi } from '@/data/fixtures/organisation'
import { countBy, madeForThem, ofView, rowsFor, standingOf } from './consent-list'

const ROSEWOOD = 'site-rosewood-court' as const
const residents = () => residentsBySite(ROSEWOOD)

const capacity = { kind: 'has_capacity' } as unknown as never

describe('what the home is expected to hold', () => {
  it('is a row per resident per consent type the home asks', () => {
    const all = rowsFor(residents())
    expect(all.length).toBe(residents().length * CONSENT_TYPES.length)
  })

  it('counts every row into exactly one state', () => {
    const all = rowsFor(residents())
    const total = Object.values(countBy(all)).reduce((running, n) => running + n, 0)
    expect(total).toBe(all.length)
  })

  /*
   * **CON-01's own figures.** The PRD quotes 42 never sought across 28
   * residents and 8 types, out of 224 the home is expected to hold, and 64 of
   * the decisions made for somebody rather than by them. The fixtures produce
   * exactly those.
   */
  it('produces the exact figures CON-01 quotes', () => {
    const all = rowsFor(residents())
    expect(residents()).toHaveLength(28)
    expect(CONSENT_TYPES).toHaveLength(8)
    expect(all).toHaveLength(224)
    expect(countBy(all).never_sought).toBe(42)
    expect(madeForThem(all).forThem).toBe(64)
  })
})

/**
 * The distinction CON-01 puts in its own tab: who decided, not what was
 * decided. A refusal an attorney entered and a refusal the resident spoke are
 * different facts, and flattening them would put somebody else's decision
 * under the resident's name.
 */
describe('who decided', () => {
  /*
   * Built and cast, rather than typed through `ConsentStatus<K>`: recording is
   * where the scope rule bites, and these are reads. The cast is confined to
   * this helper so no test invents a shape the union does not have.
   */
  const given = (by: Record<string, unknown>): AnyConsent =>
    ({
      kind: 'given',
      on: '2026-01-01' as IsoDate,
      method: 'written',
      recordedBy: staffAkinyemi,
      by,
    }) as unknown as AnyConsent

  it('reads a decision the resident made as theirs', () => {
    expect(standingOf(given({ kind: 'the_resident', assessment: capacity }))).toEqual({
      kind: 'given_by_them',
    })
  })

  it('reads a best-interests decision as decided for them, not as given', () => {
    expect(
      standingOf(
        given({
          kind: 'best_interests',
          assessment: capacity,
          consulted: ['a daughter'],
          rationale: 'why',
        }),
      ),
    ).toEqual({ kind: 'decided_for_them', how: 'best_interests' })
  })

  it('reads an attorney’s refusal as decided for them, not as the resident refusing', () => {
    const refused = {
      kind: 'refused',
      on: '2026-01-01' as IsoDate,
      note: 'no',
      recordedBy: staffAkinyemi,
      by: {
        kind: 'lpa_holder',
        assessment: capacity,
        who: 'a son',
        documentId: 'doc-1',
      },
    } as unknown as AnyConsent
    expect(standingOf(refused)).toEqual({
      kind: 'decided_for_them',
      how: 'lpa_holder',
    })
    expect(ofView([{ standing: standingOf(refused) }] as never, 'refused')).toEqual([])
  })

  it('counts decisions made for somebody out of decisions made, never out of every row', () => {
    const all = rowsFor(residents())
    const { forThem, decided } = madeForThem(all)
    const counts = countBy(all)
    expect(decided).toBe(all.length - counts.never_sought - counts.awaiting)
    expect(decided).toBeLessThan(all.length)
    expect(forThem).toBeLessThanOrEqual(decided)
  })
})
