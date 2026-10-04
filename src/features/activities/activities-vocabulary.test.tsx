import { vi } from 'vitest'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

/**
 * The activities calendar says the organisation's word, and agrees its count.
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

const navigation = vi.hoisted(() => ({ pathname: '/activities', params: {} }))
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
    `/activities?at=09:37${terms === '' ? '' : `&terms=${terms}`}`,
  )
  const [route, people, session, render] = await Promise.all([
    import('./ActivitiesRoute'),
    import('@/data/fixtures/organisation'),
    import('@/data/access/session-losses'),
    import('@/test/render-signed-in'),
  ])
  session.endSession()
  return {
    ActivitiesRoute: route.ActivitiesRoute,
    invitedLine: route.invitedLine,
    staffAkinyemi: people.staffAkinyemi,
    renderSignedIn: render.renderSignedIn,
  }
}

describe('the invitation line', () => {
  /*
   * **It was a conditional, which is a second copy of the rule.** The sentence
   * built its own plural — `n === 1 ? 'resident was' : 'residents were'` — and
   * `check-plural-agreement` could not see it, because it looks for a count
   * beside a *declared* form. It goes through `pluralise` now.
   */
  it('agrees the count with the plural the vocabulary declares', async () => {
    const m = await loadUnder(OTHER)
    expect(m.invitedLine(4)).toContain('4 people supported were invited')
    expect(m.invitedLine(1)).toContain('1 person supported was invited')
    expect(m.invitedLine(4)).not.toContain('person supporteds')
    expect(m.invitedLine(4)).not.toContain('residents were invited')
  })

  it('still agrees at one, which is where a plural parts company', async () => {
    const m = await loadUnder('')
    expect(m.invitedLine(1)).toContain('1 resident was invited')
    expect(m.invitedLine(4)).toContain('4 residents were invited')
  })

  it('renders the line it builds', async () => {
    const m = await loadUnder(OTHER)
    m.renderSignedIn(m.staffAkinyemi.id, <m.ActivitiesRoute />, ROSEWOOD)
    await screen.findByText(/invited to them/)
    expect(document.body.textContent).toContain('people supported were invited')
    expect(document.body.textContent).not.toContain('residents were invited')
  })
})
