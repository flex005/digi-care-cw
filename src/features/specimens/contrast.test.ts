import { describe, expect, it } from 'vitest'
import { contrastRatio, formatRatio, parseRgb } from './contrast'

describe('contrast', () => {
  it('measures black on white at the WCAG maximum', () => {
    expect(formatRatio(contrastRatio([0, 0, 0], [255, 255, 255]))).toBe('21.00:1')
  })

  it('is symmetric, so the order of a pair cannot change its verdict', () => {
    expect(contrastRatio([105, 53, 207], [255, 255, 255])).toBeCloseTo(
      contrastRatio([255, 255, 255], [105, 53, 207]),
    )
  })

  /*
   * A value independently known, not one computed by this function and typed
   * back in: WCAG's own worked figure for #767676 on white is 4.54:1.
   */
  it('agrees with a published reference pair', () => {
    expect(formatRatio(contrastRatio([118, 118, 118], [255, 255, 255]))).toBe('4.54:1')
  })

  it('reads both spellings getComputedStyle returns', () => {
    expect(parseRgb('rgb(30, 0, 89)')).toEqual([30, 0, 89])
    expect(parseRgb('rgb(30 0 89)')).toEqual([30, 0, 89])
    expect(parseRgb('transparent')).toBeUndefined()
  })
})
