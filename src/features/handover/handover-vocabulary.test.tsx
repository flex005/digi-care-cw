import { vi } from 'vitest'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

/**
 * The handover board says the organisation's word, not this build's.
 *
 * **The counted sentences are the point of this module being converted early.**
 * The board is where a count sits beside the subject word — "of 28 residents
 * living at Rosewood Court" — which is the shape `check-plurals` cannot see and
 * `check-plural-agreement` exists for. A plural that disagreed with its count
 * would read "of 1 service users", which is the defect that guard was written
 * after, nineteen times over, in the other build.
 *
 * The vocabulary shares no token with the default, so a pass cannot come from
 * two vocabularies agreeing on a word.
 */

const navigation = vi.hoisted(() => ({ pathname: '/handover', params: {} }))
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
  window.history.replaceState(
    null,
    '',
    `/handover?at=09:37${terms === '' ? '' : `&terms=${terms}`}`,
  )
  const [route, people, session, render] = await Promise.all([
    import('./HandoverRoute'),
    import('@/data/fixtures/organisation'),
    import('@/data/access/session-losses'),
    import('@/test/render-signed-in'),
  ])
  session.endSession()
  return {
    HandoverRoute: route.HandoverRoute,
    staffAkinyemi: people.staffAkinyemi,
    renderSignedIn: render.renderSignedIn,
  }
}

async function openBoard(terms: string) {
  const m = await loadUnder(terms)
  m.renderSignedIn(m.staffAkinyemi.id, <m.HandoverRoute />, ROSEWOOD)
  /*
   * The page head renders before the board loads, so waiting on the title
   * returns an empty screen. Wait for a sentence only the loaded board has —
   * and one whose wording does not depend on which vocabulary is in force.
   */
  await screen.findAllByText(/at this home, whether or not anybody has got to them yet/)
  return document.body.textContent ?? ''
}

describe('the board asks the vocabulary for its words', () => {
  it('names the subject singular and plural, and never this build’s own', async () => {
    const said = await openBoard(OTHER)
    // Singular, in the line that says what the board is counted over.
    expect(said).toContain(
      'Every person supported at this home, whether or not anybody has got to them yet.',
    )
    /*
     * Plural, as the card's own heading. Read from the headings directly: a
     * `getByRole` name lookup over a board this size took fifteen minutes and
     * timed out, which is a fact about the query rather than about the screen.
     */
    const headings = [...document.querySelectorAll('h1, h2, h3')].map((node) =>
      (node.textContent ?? '').trim(),
    )
    expect(headings).toContain('People supported')
    expect(headings).not.toContain('Residents')
    expect(said).not.toContain('Every resident at this home')
  })

  /*
   * **A count and its noun, agreeing.** "People supported" is the case that
   * proves the plural cannot be derived — no `s` append reaches it — so a
   * denominator rendering "28 person supporteds" would be the defect the six
   * declared forms exist to prevent.
   */
  it('agrees the denominator with the plural the vocabulary declares', async () => {
    const said = await openBoard(OTHER)
    /*
     * **Each sentence pinned by its own tail.** "of N people supported living
     * at Rosewood Court" is true of two different sentences on this board — the
     * dark card's and the group claim's — so an assertion written without the
     * tail passed while one of the two was mutated back. The whole point of
     * this file is that an assertion which cannot disagree is worth nothing.
     */
    expect(said).toMatch(/of \d+ people supported living at Rosewood Court/)
    expect(said).toMatch(/of \d+ people supported living at .+ have not been looked at/)
    expect(said).toMatch(/of \d+ people supported reviewed this shift/)
    expect(said).not.toMatch(/person supporteds/)
    expect(said).not.toMatch(/of \d+ person supported /)
    expect(said).not.toMatch(/of \d+ residents/)
  })

  it('names the subject in the accessible name of the status filter', async () => {
    await openBoard(OTHER)
    expect(screen.getByRole('group', { name: 'Person supported status' })).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'Resident status' })).toBeNull()
  })

  it('says this build’s own words when nothing is asked for', async () => {
    const said = await openBoard('')
    expect(said).toContain('Every resident at this home')
    expect(said).toMatch(/of \d+ residents living at Rosewood Court/)
    expect(said).not.toContain('person supported')
  })
})
