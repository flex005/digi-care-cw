import { vi } from 'vitest'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

/**
 * The first screen anybody opens says the organisation's words.
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

const navigation = vi.hoisted(() => ({ pathname: '/', params: {} }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const ROSEWOOD = 'site-rosewood-court' as const
const OTHER =
  'subject:person_supported,carePlan:care_and_support_plan,medication:medicines'

beforeEach(() => {
  vi.resetModules()
})

async function loadUnder(terms: string) {
  vi.resetModules()
  window.history.replaceState(
    null,
    '',
    `/?at=09:37${terms === '' ? '' : `&terms=${terms}`}`,
  )
  const [route, people, session, render] = await Promise.all([
    import('./DashboardRoute'),
    import('@/data/fixtures/organisation'),
    import('@/data/access/session-losses'),
    import('@/test/render-signed-in'),
  ])
  session.endSession()
  return {
    DashboardRoute: route.DashboardRoute,
    NO_COMBINED_LINE: route.NO_COMBINED_LINE,
    staffAkinyemi: people.staffAkinyemi,
    renderSignedIn: render.renderSignedIn,
  }
}

describe('the dashboard', () => {
  async function open(terms: string) {
    const m = await loadUnder(terms)
    m.renderSignedIn(m.staffAkinyemi.id, <m.DashboardRoute />, ROSEWOOD)
    await screen.findAllByText(/Medication today|Medicine today/)
    return { m, said: document.body.textContent ?? '' }
  }

  /*
   * **A count beside the term, which is the ordinary case here rather than an
   * edge one.** Through `pluralise`, so the two agree: built by hand it would
   * read "28 person supporteds".
   */
  it('agrees a count with the plural the vocabulary declares', async () => {
    const { said } = await open(OTHER)
    expect(said).toMatch(/of \d+ people supported/)
    expect(said).not.toMatch(/person supporteds/)
    expect(said).not.toMatch(/of \d+ residents\b/)
  })

  it('names the other two terms in the completion labels', async () => {
    const { said } = await open(OTHER)
    expect(said).toContain('Medicine today')
    expect(said).toContain('Care & support plan domains')
    expect(said).not.toContain('Medication today')
    expect(said).not.toContain('Care plan domains')
  })

  /** The line said where the combined figure would have been. */
  it('names the subject in the line refusing a combined figure', async () => {
    const m = await loadUnder(OTHER)
    expect(m.NO_COMBINED_LINE).toContain('rather than to a person supported')
    expect(m.NO_COMBINED_LINE).not.toContain('rather than to a resident')
  })

  it('says this build’s own words when nothing is asked for', async () => {
    const { said } = await open('')
    expect(said).toMatch(/of \d+ residents\b/)
    expect(said).toContain('Medication today')
  })
})
