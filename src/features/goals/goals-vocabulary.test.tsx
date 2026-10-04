import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { IsoDateTime } from '@/data/types'

/**
 * Goals say the organisation's word, and keep the subject's own voice out of it.
 *
 * **This module is where the possessive lives**, which is the form a call site
 * is likeliest to build by hand — `one` with an apostrophe-s appended renders
 * the identical string for every term offered today, so no test here can tell
 * the two apart. `scripts/check-term-forms.mjs` reads the source for that;
 * this reads the screen for whether the right word arrived at all.
 *
 * **What is deliberately not asserted**: the goal text itself. A goal is in the
 * person's own words — "I want to shower standing up again" — and is fixture
 * data rather than copy, so no vocabulary touches it and none should.
 */

const navigation = vi.hoisted(() => ({ pathname: '/goals', params: {} }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const ROSEWOOD = 'site-rosewood-court' as const
/** Two terms, neither sharing a token with the word this build uses. */
const OTHER = 'subject:person_supported,carePlan:care_and_support_plan'

beforeEach(() => {
  vi.resetModules()
})

async function loadUnder(terms: string) {
  window.history.replaceState(
    null,
    '',
    `/goals?at=09:37${terms === '' ? '' : `&terms=${terms}`}`,
  )
  const [route, parts, people, session, render, fixtures, clock] = await Promise.all([
    import('./GoalsRoute'),
    import('./goal-parts'),
    import('@/data/fixtures/organisation'),
    import('@/data/access/session-losses'),
    import('@/test/render-signed-in'),
    import('@/data/fixtures/goals'),
    import('@/data/fixtures/clock'),
  ])
  session.endSession()
  return {
    GoalsRoute: route.GoalsRoute,
    ResidentViewBadge: parts.ResidentViewBadge,
    GoalMeta: parts.GoalMeta,
    goals: fixtures.goals,
    now: clock.now,
    staffAkinyemi: people.staffAkinyemi,
    renderSignedIn: render.renderSignedIn,
  }
}

describe('the possessive comes from the vocabulary', () => {
  it('says whose words a goal is in, in the declared possessive', async () => {
    const m = await loadUnder(OTHER)
    m.renderSignedIn(m.staffAkinyemi.id, <m.GoalsRoute />, ROSEWOOD)
    await screen.findByRole('heading', { level: 1, name: 'Goals' })
    const said = document.body.textContent ?? ''
    expect(said).toContain('in the person supported’s words')
    expect(said).not.toContain('in the resident’s words')
    // Built by hand it would be a straight quote; the vocabulary declares a curly one.
    expect(said).not.toContain("person supported's words")
  })

  it('says this build’s own possessive when nothing is asked for', async () => {
    const m = await loadUnder('')
    m.renderSignedIn(m.staffAkinyemi.id, <m.GoalsRoute />, ROSEWOOD)
    await screen.findByRole('heading', { level: 1, name: 'Goals' })
    expect(document.body.textContent).toContain('in the resident’s words')
  })
})

describe('what the subject said about closing their goal', () => {
  it('names them in the chosen word in all three answers', async () => {
    const m = await loadUnder(OTHER)
    for (const [view, expected] of [
      [{ kind: 'agreed' as const }, 'The person supported agreed'],
      [
        { kind: 'disagreed' as const, note: 'She wants to keep trying.' },
        'The person supported disagreed',
      ],
      [{ kind: 'not_asked' as const }, 'The person supported was not asked'],
    ] as const) {
      const { unmount } = render(<m.ResidentViewBadge view={view} />)
      expect(document.body.textContent, expected).toContain(expected)
      expect(document.body.textContent).not.toContain('The resident')
      unmount()
    }
  })
})

describe('a second term in the same module', () => {
  /*
   * The care plan term, which this module reaches through a goal's domain. It
   * carries an ampersand that no transform should ever touch, which is the
   * other half of the argument for declaring every form.
   */
  it('names the care plan in the chosen word, ampersand intact', async () => {
    const m = await loadUnder(OTHER)
    // The badge a goal gets when nobody linked it to a domain.
    const unlinked = m.goals.find((goal) => goal.domain.kind !== 'domain')
    expect(unlinked, 'no fixture goal is unlinked from a domain').toBeTruthy()
    m.renderSignedIn(
      m.staffAkinyemi.id,
      <m.GoalMeta goal={unlinked!} now={m.now().toISOString() as IsoDateTime} />,
      ROSEWOOD,
    )
    const said = document.body.textContent ?? ''
    expect(said).toContain('No care & support plan domain')
    expect(said).not.toContain('No care plan domain')
  })
})
