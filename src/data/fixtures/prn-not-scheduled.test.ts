import { vi } from 'vitest'

/*
 * Pinned to a full instant, 16/09/2026 at 20:20 BST, so a window is open and
 * a round is part-recorded: the states a PRN must never reach are all reachable
 * for a scheduled drug at this moment (CLAUDE.md §8, on pins).
 */
vi.hoisted(() => {
  window.history.replaceState(null, '', '/?at=2026-09-16T19:20:00Z')
})

import { describe, expect, it } from 'vitest'
import type { IsoDateTime, SiteId } from '@/data/types'
import {
  MAR_HISTORY_DAYS,
  fellDueAt,
  isScheduledDaysAgo,
  marRecordsAll,
  medications,
} from './medications'
import { now } from './clock'
import { getOmissions } from '@/data/access/client'
import { weekBefore } from '@/features/medications/omissions/omission-views'

/**
 * **A PRN is by definition not scheduled** (corrected 05/11/2026). Its chart
 * holds the doses somebody chose to give, and nothing else: no window, no
 * omission, no refusal of a dose nobody offered at a round.
 */

const asRequired = new Set(
  medications
    .filter((medication) => medication.isPrn)
    .map((medication) => medication.id),
)
const prnCells = marRecordsAll.filter((record) => asRequired.has(record.medicationId))
const scheduledCells = marRecordsAll.filter(
  (record) => !asRequired.has(record.medicationId),
)

describe('an as-required drug on the chart', () => {
  it('has doses given and nothing else, while scheduled drugs keep every state', () => {
    expect(new Set(prnCells.map((record) => record.state.kind))).toEqual(
      new Set(['given', 'not_due']),
    )
    expect(new Set(scheduledCells.map((record) => record.state.kind))).toEqual(
      new Set(['given', 'not_given', 'omitted', 'due', 'not_due']),
    )
  })

  it('is scheduled on no day, while a scheduled drug is on some', () => {
    const days = Array.from({ length: MAR_HISTORY_DAYS }, (_, day) => day)
    const prn = medications.filter((medication) => medication.isPrn)
    const scheduled = medications.filter((medication) => !medication.isPrn)
    expect(
      prn.filter((medication) =>
        days.some((day) => isScheduledDaysAgo(medication, day)),
      ),
    ).toEqual([])
    expect(
      scheduled.every((medication) =>
        days.some((day) => isScheduledDaysAgo(medication, day)),
      ),
    ).toBe(true)
  })

  it('never fell due, so no figure counts it among the doses owed', () => {
    const given = prnCells.filter((record) => record.state.kind === 'given')
    expect(given.length).toBeGreaterThan(0)
    expect(given.every((record) => fellDueAt(record) === 'not_due')).toBe(true)
  })

  it('is never an omission on the omissions list', async () => {
    const at = now().toISOString() as IsoDateTime
    const { omissions } = await getOmissions(
      'site-rosewood-court' as SiteId,
      weekBefore(at),
    )
    expect(omissions.length).toBeGreaterThan(0)
    expect(omissions.filter((omission) => omission.medication.isPrn)).toEqual([])
  })
})
