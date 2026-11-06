import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ActionRow } from './ActionRow'

/**
 * Which shape an action row takes for how many actions it holds. **That the
 * shapes lay out as they should is a measurement**, and jsdom has no layout:
 * `scripts/check-action-rows.mjs` measures Today's pair and the composer's rail
 * at 390 wide.
 */
const row = (count: number, withEmpty = false) => {
  const { container } = render(
    <ActionRow>
      {withEmpty ? null : undefined}
      {Array.from({ length: count }, (_, index) => (
        <button key={index} type="button">
          Action {index + 1}
        </button>
      ))}
    </ActionRow>,
  )
  return container.querySelector<HTMLElement>('[data-action-row]')
}

describe('an action row', () => {
  it('puts one or two actions side by side, sharing the width', () => {
    expect(row(1)?.dataset.actionRow).toBe('pair')
    expect(row(2)?.dataset.actionRow).toBe('pair')
  })

  it('makes three or more a rail', () => {
    expect(row(3)?.dataset.actionRow).toBe('rail')
    expect(row(4)?.dataset.actionRow).toBe('rail')
  })

  it('counts the actions drawn, not an action left out', () => {
    expect(row(2, true)?.dataset.actionRow).toBe('pair')
  })
})
