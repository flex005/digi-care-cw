import { vi } from 'vitest'

/*
 * **A full instant, written with a `Z`**: 16/09/2026 at 19:20 UTC, 20:20 at
 * the home on British Summer Time. This file depends on the instant: pinned to
 * 03:00 GMT on 01/12/2026 instead, three tests about doses in and out of their
 * window fail. `?at=20:20` left the date and the zone to the machine (CLAUDE.md
 * §8, on pins).
 */
vi.hoisted(() => {
  window.history.replaceState(null, '', '/?at=2026-09-16T19:20:00Z')
})

import { describe, expect, it } from 'vitest'
import type { IsoDate, IsoDateTime } from '@/data/types'
import { marRecordsAll, medications } from '@/data/fixtures/medications'
import { residentsBySite } from '@/data/fixtures/residents'
import { incidents } from '@/data/fixtures/incidents'
import { now } from '@/data/fixtures/clock'
import { ROUND_TIMES } from '@/data/fixtures/rounds'
import { zonedDate } from '@/lib/format'
import { byOldest, type LateItem } from './late-items'
import {
  carePlanDomains,
  consents,
  dosesPastTheirWindow,
  dueSoon,
  incidentsAcknowledged,
  medicationToday,
  missing,
  riskAssessments,
  roundCounts,
} from './dashboard-figures'

/**
 * The dashboard's arithmetic, against the fixtures the screens read.
 *
 * **Every figure is checked against the module it summarises**, because the
 * defect this screen invites is a summary that disagrees with the screen it
 * points into.
 */

const at = now().toISOString() as IsoDateTime
const ROSEWOOD = 'site-rosewood-court' as const
const residents = residentsBySite(ROSEWOOD)
const ids = new Set(residents.map((resident) => resident.id))
const today: IsoDate = zonedDate(at, 'Europe/London')
const records = marRecordsAll.filter(
  (record) => ids.has(record.residentId) && record.date === today,
)
const theirMedications = medications.filter((entry) => ids.has(entry.residentId))

describe('a bar', () => {
  it('has nothing missing when everything expected is recorded', () => {
    expect(missing({ recorded: 8, expected: 8 })).toBe(0)
    expect(missing({ recorded: 5, expected: 8 })).toBe(3)
  })

  it('takes a finding out of the gap, never counting it twice', () => {
    // 38 acknowledged, 2 unacknowledged, of 40: nothing is missing.
    expect(missing({ recorded: 38, expected: 40 }, 2)).toBe(0)
  })
})

describe('the medication figures', () => {
  /*
   * **Against the round columns, not against a restatement of itself.** This
   * test once filtered the records the way the function does and compared the
   * two, so it agreed by construction — including on counting every PRN given
   * today as a dose that was due. The columns are a second owner, built from
   * the prescriptions rather than the cells, and the two must agree.
   */
  it('counts the doses that were due today, as the round columns do', () => {
    const bar = medicationToday(records)
    const columns = ROUND_TIMES.map((round) =>
      roundCounts(records, theirMedications, round, at),
    )
    expect(bar.recorded).toBe(columns.reduce((sum, column) => sum + column.recorded, 0))
    expect(bar.expected).toBe(columns.reduce((sum, column) => sum + column.total, 0))
  })

  it('counts a PRN given today as neither due nor recorded: nobody owed it', () => {
    const asRequired = new Set(
      theirMedications.filter((entry) => entry.isPrn).map((entry) => entry.id),
    )
    const prnGiven = records.filter(
      (record) => asRequired.has(record.medicationId) && record.state.kind === 'given',
    )
    expect(prnGiven.length).toBeGreaterThan(0)
    const without = records.filter((record) => !asRequired.has(record.medicationId))
    expect(medicationToday(records)).toEqual(medicationToday(without))
  })

  it('counts a dose past its window as one nobody recorded', () => {
    expect(dosesPastTheirWindow(records)).toBe(
      records.filter((record) => record.state.kind === 'omitted').length,
    )
  })

  /*
   * Due now and due shortly are both work arriving in the next two hours; a
   * dose whose window has closed is an omission and is counted as one.
   */
  it('counts doses still inside their window and those about to open', () => {
    const soon = dueSoon(records, at)
    const open = records.filter((record) => record.state.kind === 'due')
    expect(soon.doses).toBe(open.length)
    expect(soon.doses).toBeGreaterThan(0)
    expect(soon.residents).toBeLessThanOrEqual(soon.doses)
    expect(soon.residents).toBeGreaterThan(0)
  })

  it('leaves out a dose whose window has closed: that is an omission', () => {
    const closed = records.filter((record) => record.state.kind === 'omitted')
    expect(closed.length).toBeGreaterThan(0)
    expect(dueSoon(closed, at).doses).toBe(0)
  })
})

describe('the round columns', () => {
  it('reads the same records the MAR does, round by round', () => {
    for (const round of ROUND_TIMES) {
      const counts = roundCounts(records, theirMedications, round, at)
      const cells = records.filter(
        (record) => record.roundTime === round && record.state.kind !== 'not_due',
      )
      const scheduled = cells.filter((record) =>
        theirMedications.some(
          (entry) =>
            entry.id === record.medicationId &&
            !entry.isPrn &&
            entry.roundTimes.includes(round),
        ),
      )
      expect(counts.total).toBe(scheduled.length)
      expect(counts.recorded + counts.dueNotRecorded).toBeLessThanOrEqual(counts.total)
    }
  })

  it('counts a dose still inside its window as recorded or not, never both', () => {
    for (const round of ROUND_TIMES) {
      const counts = roundCounts(records, theirMedications, round, at)
      expect(counts.recorded).toBeLessThanOrEqual(counts.total)
      expect(counts.dueNotRecorded).toBeLessThanOrEqual(counts.total)
    }
  })
})

describe('the record bars', () => {
  it('counts risk, care plan and consent over what the home asks', () => {
    for (const bar of [
      riskAssessments(residents),
      carePlanDomains(residents),
      consents(residents),
    ]) {
      expect(bar.expected).toBeGreaterThan(0)
      expect(bar.recorded).toBeLessThanOrEqual(bar.expected)
      // Every resident contributes its own denominator: nothing is per-home.
      expect(bar.expected).toBeLessThanOrEqual(residents.length * 10)
    }
  })

  it('narrows with the residents counted', () => {
    const half = residents.slice(0, Math.floor(residents.length / 2))
    expect(riskAssessments(half).expected).toBeLessThan(
      riskAssessments(residents).expected,
    )
  })
})

describe('the incidents bar', () => {
  /*
   * An unacknowledged incident is a finding, not missing data: somebody wrote
   * it down and nobody has picked it up. DASH-01 says so, and the bar keeps it
   * apart from the hatch.
   */
  it('keeps the unacknowledged apart from the recorded, and adds up', () => {
    const here = incidents.filter((incident) => incident.siteId === ROSEWOOD)
    const bar = incidentsAcknowledged(here)
    expect(bar.expected).toBe(here.length)
    expect(bar.unacknowledged).toBe(
      here.filter((incident) => incident.status.kind === 'reported_not_acknowledged')
        .length,
    )
    expect(bar.recorded + bar.unacknowledged).toBe(bar.expected)
    expect(missing(bar, bar.unacknowledged)).toBe(0)
  })
})

describe('the order of already late', () => {
  const item = (id: string, dueAt: string): LateItem => ({
    id,
    kind: 'review',
    what: id,
    who: 'Somebody',
    dueAt: dueAt as IsoDateTime,
    daysLate: 1,
    action: { label: 'Start review', href: '/' },
  })

  it('puts the longest wait first, because the wait is the finding', () => {
    const ordered = byOldest([
      item('newest', '2026-09-17T09:00:00.000Z'),
      item('oldest', '2025-04-02T09:00:00.000Z'),
      item('middle', '2026-01-11T09:00:00.000Z'),
    ])
    expect(ordered.map((entry) => entry.id)).toEqual(['oldest', 'middle', 'newest'])
  })
})
