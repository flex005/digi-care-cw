import { describe, expect, it } from 'vitest'
import type { IsoDateTime } from '@/data/types'
import { medications } from '@/data/fixtures/medications'
import { patchedRecords } from '@/data/access/mar-store'
import { todaysChart } from './phone-chart'

/**
 * A dose prescribed at a round with no record held for it: the desktop chart's
 * `not_held`. **No fixture reaches it today, so the state is built here** by
 * dropping one record from a copy of the real ones; the fixtures, which feed
 * both builds, are not touched.
 */

/* A full instant, as every test that reads the day does: 20:20 BST, 16/09/2026. */
const AT = '2026-09-16T19:20:00Z' as IsoDateTime
const DAY = '2026-09-16'
const PERSON = 'res-pemberton'

const drugs = medications.filter((drug) => drug.residentId === PERSON)
const records = patchedRecords().filter((record) => record.residentId === PERSON)
const dropped = records.find(
  (record) =>
    record.date === DAY &&
    record.roundTime === '08:00' &&
    record.state.kind === 'given',
)

describe('a dose prescribed at a round with no record held', () => {
  it('stays on the chart at its round as not held, and leaves the figure', () => {
    if (dropped === undefined) throw new Error('No dose given at 08:00 to drop')
    const whole = todaysChart({ drugs, records, at: AT, timeZone: 'Europe/London' })
    const gap = todaysChart({
      drugs,
      records: records.filter((record) => record !== dropped),
      at: AT,
      timeZone: 'Europe/London',
    })

    const at0800 = gap.rounds.find((round) => round.roundTime === '08:00')
    const dose = at0800?.doses.find((entry) => entry.drug.id === dropped.medicationId)
    expect(dose?.cell).toEqual({ kind: 'not_held' })
    // Still at its round, not moved to "not due today".
    expect(gap.notDueToday.map((drug) => drug.id)).not.toContain(dropped.medicationId)
    // No record means nothing to count either way: not recorded, and not due.
    expect(gap.due).toBe(whole.due - 1)
    expect(gap.recorded).toBe(whole.recorded - 1)
  })
})
