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

  it('rounds months from the minutes too, so 76 days 7 hours 12 minutes is 3 months, not 2', () => {
    // 76.3 days is 2.507 average months. Rounded to 76 days first, it was 2.497.
    expect(formatWait(76 * 24 * 60 + 7 * 60 + 12)).toBe('3 months')
  })

  it('hands the span over in whole days below two months, where days are printed', () => {
    expect(formatWait(59 * 24 * 60 + 9 * 60)).toBe('59 days')
    expect(formatWait(59 * 24 * 60 + 15 * 60)).toBe('2 months')
  })

  it('keeps years and months beyond two years', () => {
    expect(formatWait(800 * 24 * 60)).toBe('2 years 2 months')
  })

  it('keeps hours under two days and minutes under an hour', () => {
    expect(formatWait(59)).toBe('59 minutes')
    expect(formatWait(47 * 60 + 29)).toBe('47 hours')
  })
})
