import { vi } from 'vitest'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

/**
 * Risk says the organisation's word — and never renames the instruments.
 *
 * **The conversion is asserted here or nowhere.** Every other test in this
 * module passed the moment the words moved, because the default vocabulary
 * renders the identical string — so an assertion on this build's own word
 * cannot tell a sentence that asked from one with the word typed into it. The
 * ratchet in `check-vocabulary-coverage` catches a word coming back, but it
 * cannot say which position it is in. This can.
 *
 * The vocabulary shares no token with the default, so a pass cannot come from
 * two vocabularies agreeing on a word.
 */

vi.setConfig({ testTimeout: 20_000 })

const navigation = vi.hoisted(() => ({ pathname: '/risk-assessments', params: {} }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const ROSEWOOD = 'site-rosewood-court' as const
const OTHER = 'subject:person_supported,assessment:clinical_assessment'

beforeEach(() => {
  vi.resetModules()
})

async function loadUnder(terms: string) {
  vi.resetModules()
  window.history.replaceState(
    null,
    '',
    `/risk-assessments?at=09:37${terms === '' ? '' : `&terms=${terms}`}`,
  )
  const [route, people, session, render] = await Promise.all([
    import('./RiskListRoute'),
    import('@/data/fixtures/organisation'),
    import('@/data/access/session-losses'),
    import('@/test/render-signed-in'),
  ])
  session.endSession()
  return {
    RiskListRoute: route.RiskListRoute,
    COUNTED_LINE: route.COUNTED_LINE,
    staffAkinyemi: people.staffAkinyemi,
    renderSignedIn: render.renderSignedIn,
  }
}

describe('the risk list', () => {
  /*
   * §1: every template the home uses is listed whether or not anybody has
   * opened one, and the heading saying so carries the subject term.
   */
  it('names the subject in the line about every template', async () => {
    const m = await loadUnder(OTHER)
    expect(m.COUNTED_LINE).toContain('Every person supported at this home')
    expect(m.COUNTED_LINE).not.toContain('Every resident at this home')
  })

  /*
   * **And "assessment" does not move, under a vocabulary that renames it.**
   * Every use here names an instrument — the Waterlow, the Morse Fall Scale —
   * so a service calling its assessments something else does not get to reword
   * a validated scale. This is the floor asserting itself.
   */
  it('leaves the instrument’s own word alone under a vocabulary that renames it', async () => {
    const m = await loadUnder(OTHER)
    m.renderSignedIn(m.staffAkinyemi.id, <m.RiskListRoute />, ROSEWOOD)
    await screen.findByRole('heading', { level: 1, name: 'Risk assessments' })
    const said = document.body.textContent ?? ''
    expect(said).toContain('Risk assessments')
    expect(said).not.toContain('Risk clinical assessments')
    expect(said).not.toContain('clinical assessment')
  })

  it('says this build’s own word when nothing is asked for', async () => {
    const m = await loadUnder('')
    expect(m.COUNTED_LINE).toContain('Every resident at this home')
  })
})
