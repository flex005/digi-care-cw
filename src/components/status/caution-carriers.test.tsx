import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Toast, ToastProvider, ToastViewport } from '@/components/primitives'
import { StatusPill } from './StatusPill'
import pillStyles from './StatusPill.module.css'
import toastStyles from '../primitives/Toast.module.css'

/**
 * The half of the caution rule a script cannot hold: each component allowed to
 * draw the caution fill draws its words inside the coloured element, refuses
 * empty words, and keeps the words required.
 *
 * `check-caution-carriers.mjs` holds the other half, that nothing else draws
 * the fill. Neither checks that the words name the state; that is a question
 * about meaning, asked in review.
 */
describe('the caution fill carries words', () => {
  it('draws a caution pill’s label inside the coloured pill', () => {
    const { container } = render(<StatusPill tone="caution" label="Needs attention" />)
    const pill = container.querySelector(`.${pillStyles.caution}`)
    expect(pill?.textContent).toBe('Needs attention')
  })

  it('draws a caution toast’s title inside the edged panel', () => {
    const { baseElement } = render(
      <ToastProvider>
        <Toast open onOpenChange={vi.fn()} tone="caution" title="Not recorded yet" />
        <ToastViewport />
      </ToastProvider>,
    )
    const toast = baseElement.querySelector(`.${toastStyles.caution}`)
    expect(toast?.textContent).toContain('Not recorded yet')
  })

  it('refuses a caution pill with no words', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<StatusPill tone="caution" label="  " />)).toThrow(/no label/)
  })

  it('refuses a caution toast with no words', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(
        <ToastProvider>
          <Toast open onOpenChange={vi.fn()} tone="caution" title="" />
        </ToastProvider>,
      ),
    ).toThrow(/no title/)
  })

  it('keeps the words required by the type', () => {
    // @ts-expect-error — label is required. If it ever becomes optional this directive
    // has nothing to expect, and typecheck fails: removing the requirement removes it.
    const missingLabel = <StatusPill tone="caution" />
    // @ts-expect-error — title is required, for the same reason.
    const missingTitle = <Toast open onOpenChange={vi.fn()} tone="caution" />
    expect([missingLabel, missingTitle]).toHaveLength(2)
  })
})
