import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ShareBar, shareWidth } from './ShareBar'

/**
 * The floor: a figure above zero never draws an empty bar. 1 of 165 is 0.61%,
 * under a pixel on a card, and a bar that drew it as nothing would say "none"
 * where the record says "one". jsdom does not lay out, so these read the width
 * the fill is given; that a real browser draws `max(…)` wider than zero was
 * measured in Chrome (PROGRESS.md, 05/11/2026).
 */
const fillOf = (value: number, total: number) => {
  const { container } = render(<ShareBar value={value} total={total} gap={false} />)
  return (container.querySelector('[data-share-fill]') as HTMLElement).style.width
}

describe('a share bar', () => {
  it('draws a figure of 1 against 165 wider than zero: its share, or the floor if larger', () => {
    expect(shareWidth(1, 165)).toBe('max(0.61%, var(--space-8))')
    expect(fillOf(1, 165)).not.toBe('0%')
    expect(fillOf(1, 165)).not.toBe('')
  })

  it('draws an exact zero as an empty track', () => {
    expect(shareWidth(0, 165)).toBe('0%')
    expect(fillOf(0, 165)).toBe('0%')
  })

  it('draws the whole share without a floor getting in the way, and never more than the track', () => {
    expect(shareWidth(8, 28)).toBe('max(28.57%, var(--space-8))')
    expect(shareWidth(28, 28)).toBe('max(100%, var(--space-8))')
    expect(shareWidth(30, 28)).toBe('max(100%, var(--space-8))')
  })
})
