import { describe, expect, it } from 'vitest'
import type { IsoDate, Resident } from '@/data/types'
import { RISK_ASSESSMENT_TEMPLATES } from '@/data/types'
import { residentsBySite } from '@/data/fixtures/residents'
import {
  countBy,
  inReadingOrder,
  ofView,
  rowsFor,
  standingOf,
  type RiskRow,
  type RiskStanding,
} from './risk-list'

const ROSEWOOD = 'site-rosewood-court' as const
const residents = () => residentsBySite(ROSEWOOD)

const row = (standing: RiskStanding, name = 'x'): RiskRow =>
  ({
    resident: { id: name, fullLegalName: name } as unknown as Resident,
    templateId: 'falls',
    templateName: 'Falls Risk',
    standing,
  }) as RiskRow

describe('what the home is expected to hold', () => {
  /*
   * **RA-01's own figures, asserted rather than approximated.** The PRD quotes
   * 78 never assessed across 28 residents and 9 templates, out of 252 the home
   * is expected to hold, and 9 past their review date. The fixtures produce
   * exactly those, so a change to either the counting or the fixtures fails
   * here by number instead of drifting past a `greaterThan(0)`.
   */
  it('produces the exact figures RA-01 quotes', () => {
    const all = rowsFor(residents())
    const counts = countBy(all)
    expect(residents()).toHaveLength(28)
    expect(RISK_ASSESSMENT_TEMPLATES).toHaveLength(9)
    expect(all).toHaveLength(252)
    expect(counts.never_assessed).toBe(78)
    expect(counts.review_overdue).toBe(9)
  })

  it('is a row per resident per template the home uses, not a row per assessment', () => {
    const all = rowsFor(residents())
    expect(all.length).toBe(residents().length * RISK_ASSESSMENT_TEMPLATES.length)
  })

  it('counts every row into exactly one state', () => {
    const all = rowsFor(residents())
    const counts = countBy(all)
    const total = Object.values(counts).reduce((running, n) => running + n, 0)
    expect(total).toBe(all.length)
  })

  it('reads an unassessed template as never assessed, not as a low one', () => {
    const resident = residents().find(
      (entry) => entry.risks.falls.kind === 'not_assessed',
    )
    expect(resident).toBeDefined()
    expect(standingOf(resident!, 'falls')).toEqual({ kind: 'never_assessed' })
  })

  it('keeps an assessed risk with no review date out of the overdue tab', () => {
    const rows = [row({ kind: 'no_review_date' })]
    expect(ofView(rows, 'review_overdue')).toEqual([])
    expect(ofView(rows, 'review_due')).toEqual([])
    expect(ofView(rows, 'all')).toHaveLength(1)
  })
})

describe('the order RA-01 asks for', () => {
  it('puts never assessed first, then longest overdue', () => {
    const ordered = inReadingOrder([
      row({ kind: 'in_date' }, 'in-date'),
      row(
        { kind: 'review_overdue', dueOn: '2026-01-01' as IsoDate, daysOverdue: 10 },
        'ten',
      ),
      row({ kind: 'never_assessed' }, 'never'),
      row(
        { kind: 'review_overdue', dueOn: '2025-01-01' as IsoDate, daysOverdue: 400 },
        'four-hundred',
      ),
      row({ kind: 'review_due', dueOn: '2026-09-18' as IsoDate }, 'due'),
    ])
    expect(ordered.map((entry) => entry.resident.fullLegalName)).toEqual([
      'never',
      'four-hundred',
      'ten',
      'due',
      'in-date',
    ])
  })

  /*
   * A risk nobody has looked at outranks one somebody assessed and has not
   * revisited, however long ago. The second has a judgement on the record.
   */
  it('ranks never assessed above an assessment four hundred days overdue', () => {
    const ordered = inReadingOrder([
      row(
        { kind: 'review_overdue', dueOn: '2025-01-01' as IsoDate, daysOverdue: 400 },
        'overdue',
      ),
      row({ kind: 'never_assessed' }, 'never'),
    ])
    expect(ordered[0]?.resident.fullLegalName).toBe('never')
  })
})
