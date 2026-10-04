import { vi } from 'vitest'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

/**
 * Care plan reviews say both of the organisation's words.
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

const navigation = vi.hoisted(() => ({ pathname: '/reviews', params: {} }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const ROSEWOOD = 'site-rosewood-court' as const
const OTHER = 'subject:person_supported,carePlan:care_and_support_plan'

beforeEach(() => {
  vi.resetModules()
})

async function loadUnder(terms: string) {
  vi.resetModules()
  window.history.replaceState(
    null,
    '',
    `/reviews?at=09:37${terms === '' ? '' : `&terms=${terms}`}`,
  )
  const [route, people, session, render] = await Promise.all([
    import('./ReviewQueueRoute'),
    import('@/data/fixtures/organisation'),
    import('@/data/access/session-losses'),
    import('@/test/render-signed-in'),
  ])
  session.endSession()
  return {
    ReviewQueueRoute: route.ReviewQueueRoute,
    COUNTED_LINE: route.COUNTED_LINE,
    staffAkinyemi: people.staffAkinyemi,
    renderSignedIn: render.renderSignedIn,
  }
}

describe('the review queue', () => {
  it('names both terms, in the title and in what it is counted over', async () => {
    const m = await loadUnder(OTHER)
    expect(m.COUNTED_LINE).toContain('Counted over every person supported')
    m.renderSignedIn(m.staffAkinyemi.id, <m.ReviewQueueRoute />, ROSEWOOD)
    // The queue loads after the head, so wait for its own figure.
    await screen.findByText(/Owed a whole/)
    const said = document.body.textContent ?? ''
    expect(said).toContain('Care & support plan reviews')
    expect(said).toContain('Owed a whole care & support plan review')
    expect(said).not.toContain('Owed a whole care plan review')
  })

  /** The subject plural, in the accessible name of the filter. */
  it('names the subject plural in the filter’s accessible name', async () => {
    const m = await loadUnder(OTHER)
    m.renderSignedIn(m.staffAkinyemi.id, <m.ReviewQueueRoute />, ROSEWOOD)
    await screen.findByText(/Owed a whole/)
    expect(screen.getByRole('group', { name: 'Which people supported' })).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'Which residents' })).toBeNull()
  })

  it('says this build’s own words when nothing is asked for', async () => {
    const m = await loadUnder('')
    expect(m.COUNTED_LINE).toContain('Counted over every resident')
  })
})
