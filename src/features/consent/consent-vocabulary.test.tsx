import { vi } from 'vitest'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

/**
 * Consent says the organisation's word, on a screen that lists every type.
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

const navigation = vi.hoisted(() => ({ pathname: '/consent', params: {} }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const ROSEWOOD = 'site-rosewood-court' as const
const OTHER = 'subject:person_supported'

beforeEach(() => {
  vi.resetModules()
})

async function loadUnder(terms: string) {
  vi.resetModules()
  window.history.replaceState(
    null,
    '',
    `/consent?at=09:37${terms === '' ? '' : `&terms=${terms}`}`,
  )
  const [route, decision, list, people, session, render] = await Promise.all([
    import('./ConsentListRoute'),
    import('./consent-decision'),
    import('./consent-list'),
    import('@/data/fixtures/organisation'),
    import('@/data/access/session-losses'),
    import('@/test/render-signed-in'),
  ])
  session.endSession()
  return {
    ConsentListRoute: route.ConsentListRoute,
    COUNTED_LINE: route.COUNTED_LINE,
    authoritiesFor: decision.authoritiesFor,
    STANDING_MEANS: list.STANDING_MEANS,
    staffAkinyemi: people.staffAkinyemi,
    renderSignedIn: render.renderSignedIn,
  }
}

describe('the consent list', () => {
  /*
   * §1: every consent type is listed whether or not anything is recorded, and
   * the line saying so carries the term. Converting the line must not change
   * what the screen counts over.
   */
  it('names the subject in the line that says what it is counted over', async () => {
    const m = await loadUnder(OTHER)
    expect(m.COUNTED_LINE).toBe('Every person supported against every consent type.')
    m.renderSignedIn(m.staffAkinyemi.id, <m.ConsentListRoute />, ROSEWOOD)
    await screen.findAllByText(/against every consent type/)
    const said = document.body.textContent ?? ''
    expect(said).toContain('every person supported against every consent type')
    expect(said).not.toContain('every resident against every consent type')
  })

  it('names the subject in what the decision and its outcome say', async () => {
    const m = await loadUnder(OTHER)
    const labels = m
      .authoritiesFor('has_capacity', false)
      .map((option: { label: string }) => option.label)
    expect(labels).toContain('The person supported decided')
    expect(labels).not.toContain('The resident decided')
    const means = Object.values(m.STANDING_MEANS) as string[]
    expect(means).toContain('the person supported said no')
    expect(means).toContain('the person supported agreed')
  })

  it('says this build’s own word when nothing is asked for', async () => {
    const m = await loadUnder('')
    expect(m.COUNTED_LINE).toBe('Every resident against every consent type.')
  })
})
