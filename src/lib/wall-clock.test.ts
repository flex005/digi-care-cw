import { describe, expect, it } from 'vitest'
import type { IsoDateTime } from '@/data/types'
import { instantFromZonedWallClock, zonedWallClockInput, formatTime } from './format'

/**
 * Collecting a time in the home's zone. The pair has to round-trip, including
 * across a clock change, or an incident reported at 20:20 in London is stored
 * as a different minute for a reader somewhere else.
 */
describe('a wall clock in the home’s zone', () => {
  it('round-trips through the instant and back', () => {
    for (const wall of [
      '2026-09-18T20:20',
      '2026-01-14T08:05',
      '2026-06-30T23:59',
      '2026-03-29T02:30',
      '2026-10-25T01:30',
    ]) {
      const instant = instantFromZonedWallClock(wall, 'Europe/London')
      expect(zonedWallClockInput(instant, 'Europe/London')).toBe(wall)
    }
  })

  it('is the home’s clock, not the machine’s', () => {
    // 20:20 in London on a summer date is 19:20 UTC: British Summer Time.
    expect(instantFromZonedWallClock('2026-09-18T20:20', 'Europe/London')).toBe(
      '2026-09-18T19:20:00.000Z',
    )
    // And in winter the two agree.
    expect(instantFromZonedWallClock('2026-01-14T08:05', 'Europe/London')).toBe(
      '2026-01-14T08:05:00.000Z',
    )
  })

  it('renders back as the time somebody typed', () => {
    const instant = instantFromZonedWallClock('2026-09-18T20:20', 'Europe/London')
    expect(formatTime(instant as IsoDateTime, 'Europe/London')).toBe('20:20')
  })

  it('refuses something that is not a wall clock', () => {
    expect(() => instantFromZonedWallClock('not a time', 'Europe/London')).toThrow()
  })
})
