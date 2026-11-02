import { describe, expect, it } from 'vitest'
import type { IsoDateTime } from '@/data/types'
import { currentRound } from './dashboard-figures'

/**
 * Which round column is marked current, at 20:20 on the home's clock in
 * September (BST) and in November (GMT), on machines in four zones. The pair is
 * the test: the defect this holds agreed with London in one season and not the
 * other, and was invisible on a machine in London in both.
 */
const LONDON = 'Europe/London'
const SUMMER_2020 = '2026-09-16T19:20:00Z' as IsoDateTime
const WINTER_2020 = '2026-11-02T20:20:00Z' as IsoDateTime

describe('the current round, either side of a clock change', () => {
  it.each(['Europe/London', 'Africa/Lagos', 'UTC', 'America/New_York'])(
    'is the 20:00 round at 20:20 in summer and in winter, on a machine in %s',
    (machine) => {
      const was = process.env.TZ
      process.env.TZ = machine
      try {
        expect(currentRound(SUMMER_2020, LONDON)).toBe('20:00')
        expect(currentRound(WINTER_2020, LONDON)).toBe('20:00')
      } finally {
        if (was === undefined) delete process.env.TZ
        else process.env.TZ = was
      }
    },
  )
})
