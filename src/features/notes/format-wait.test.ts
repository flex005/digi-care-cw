import { describe, expect, it } from 'vitest'
import { formatWait } from './note-parts'

/**
 * A wait in one unit, rounded once. Literal minutes and literal words: the
 * defect was a value rounded to the hour and then rounded again to the day.
 */
describe('formatWait', () => {
  it('rounds days from the minutes, so 83 hours 39 minutes is 3 days, not 4', () => {
    expect(formatWait(83 * 60 + 39)).toBe('3 days')
  })

  it('still rounds a wait past the half day up', () => {
    expect(formatWait(84 * 60)).toBe('4 days')
  })

  it('keeps hours under two days and minutes under an hour', () => {
    expect(formatWait(59)).toBe('59 minutes')
    expect(formatWait(47 * 60 + 29)).toBe('47 hours')
  })
})
