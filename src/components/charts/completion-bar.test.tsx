import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CompletionBar } from './CompletionBar'

/**
 * The bar's three treatments, and that they are three.
 *
 * **Asserted on the class each segment carries, not on its data attribute.** A
 * mutation that drew the finding with the hatch's class kept the attribute and
 * passed: the attribute says what a segment is *called*, and what this rule is
 * about is what it *looks like*.
 */
describe('a completion bar', () => {
  const segment = (kind: string) =>
    document.querySelector<HTMLElement>(`[data-segment="${kind}"]`)

  it('draws recorded, a finding and a gap as three different things', () => {
    render(
      <CompletionBar
        label="Incidents acknowledged"
        recorded={5}
        expected={10}
        finding={{ count: 2, words: 'reported and not acknowledged' }}
        of="of the incidents counted here"
      />,
    )

    const recorded = segment('recorded')
    const finding = segment('finding')
    const missing = segment('missing')
    for (const part of [recorded, finding, missing]) expect(part).not.toBeNull()

    // Three treatments, never two: a finding is not a gap and neither is
    // recorded.
    const classes = [recorded, finding, missing].map((part) => part?.className ?? '')
    expect(new Set(classes).size).toBe(3)
    // And the hatch is the gap's alone.
    expect(finding?.className).not.toBe(missing?.className)
  })

  it('says all three in the one sentence a reader hears', () => {
    render(
      <CompletionBar
        label="Incidents acknowledged"
        recorded={38}
        expected={40}
        finding={{ count: 2, words: 'reported and not acknowledged' }}
        of="of the incidents counted here"
      />,
    )
    const spoken = screen.getByRole('img').getAttribute('aria-label') ?? ''
    expect(spoken).toContain('38 recorded')
    expect(spoken).toContain('2 reported and not acknowledged')
    expect(spoken).toContain('of the incidents counted here')
    // Nothing is missing on that bar, and the sentence does not invent a gap.
    expect(spoken).not.toContain('expected and missing')
  })

  it('draws no segment for a count of nothing', () => {
    render(
      <CompletionBar
        label="Care notes today"
        recorded={9}
        expected={9}
        of="of 9 residents counted here"
      />,
    )
    expect(segment('recorded')).not.toBeNull()
    expect(segment('missing')).toBeNull()
    expect(segment('finding')).toBeNull()
  })
})
