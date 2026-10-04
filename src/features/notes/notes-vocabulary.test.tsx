import { vi } from 'vitest'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { StaffId } from '@/data/types'

/**
 * Care notes say the organisation's words, and leave the record's own alone.
 *
 * **The module where the line matters most.** A note's body is what somebody
 * wrote, and a goal is in the person's own first person; neither is ever
 * re-rendered under a vocabulary (`docs/DEPARTURES.md`). What the vocabulary
 * reaches here is the copy *around* the record — the headings, the empty
 * states, the search, the composer's prompt — and one suggested opener, which
 * is product copy the writer finishes.
 *
 * The chosen vocabulary shares no token with this build's own.
 */

vi.setConfig({ testTimeout: 20_000 })

const navigation = vi.hoisted(() => ({ pathname: '/care-notes', params: {} }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const ROSEWOOD = 'site-rosewood-court' as const
const OTHER = 'subject:person_supported,family:next_of_kin'

beforeEach(() => {
  vi.resetModules()
})

async function loadUnder(terms: string) {
  window.history.replaceState(
    null,
    '',
    `/care-notes?at=09:37${terms === '' ? '' : `&terms=${terms}`}`,
  )
  const [route, picker, phrases, people, session, render] = await Promise.all([
    import('./CareNotesRoute'),
    import('./composer/ResidentPickerRoute'),
    import('./composer/suggested-phrases'),
    import('@/data/fixtures/organisation'),
    import('@/data/access/session-losses'),
    import('@/test/render-signed-in'),
  ])
  session.endSession()
  return {
    CareNotesRoute: route.CareNotesRoute,
    staffOsei: people.staffOsei,
    ResidentPickerRoute: picker.ResidentPickerRoute,
    SUGGESTED_PHRASES: phrases.SUGGESTED_PHRASES,
    staffAkinyemi: people.staffAkinyemi,
    renderSignedIn: render.renderSignedIn,
  }
}

describe('the care notes list', () => {
  /*
   * The page head renders before the notes load, so wait for a sentence only
   * the loaded list has — and one whose wording is the same whichever
   * vocabulary is in force, or the wait becomes the assertion.
   */
  async function open(terms: string, who?: StaffId) {
    const m = await loadUnder(terms)
    m.renderSignedIn(who ?? m.staffAkinyemi.id, <m.CareNotesRoute />, ROSEWOOD)
    await screen.findByText('Flagged, not reviewed', { selector: 'h2' })
    return document.body.textContent ?? ''
  }

  /** The sections are behind their own tabs, so each is opened to be read. */
  async function section(label: RegExp) {
    const user = (await import('@testing-library/user-event')).default.setup()
    const tab = screen
      .getAllByRole('button')
      .find((node) => label.test(node.textContent ?? ''))
    expect(tab, `no control reading ${String(label)}`).toBeTruthy()
    await user.click(tab!)
    return document.body.textContent ?? ''
  }

  it('names the subject in the plural where the sentence is plural', async () => {
    await open(OTHER)
    const said = await section(/^All notes/)
    expect(said).toContain('about these people supported')
    expect(said).not.toContain('about these residents')
  })

  /** Singular mid-sentence, in a subtitle about one of them. */
  it('names the subject in the singular where the sentence is singular', async () => {
    await open(OTHER)
    const said = await section(/^Your notes/)
    expect(said).toContain('A person supported with nothing here may have notes')
    expect(said).not.toContain('A resident with nothing here')
  })

  /*
   * The no-list card, which only somebody nobody has given a list ever sees —
   * and it is the one place the plural heads a heading.
   */
  it('names the subject to somebody with no list at all', async () => {
    const m = await loadUnder(OTHER)
    m.renderSignedIn(m.staffOsei.id, <m.CareNotesRoute />, ROSEWOOD)
    const said = await screen.findByText(/Care notes about your /)
    expect(said.textContent).toBe('Care notes about your people supported')
    expect(document.body.textContent).toContain(
      'has people supported and care notes about them',
    )
  })

  it('says this build’s own words when nothing is asked for', async () => {
    await open('')
    const said = await section(/^All notes/)
    expect(said).toContain('about these residents')
    expect(said).not.toContain('person supported')
  })
})

describe('choosing who to write about', () => {
  async function openPicker(terms: string) {
    const m = await loadUnder(terms)
    m.renderSignedIn(m.staffAkinyemi.id, <m.ResidentPickerRoute />, ROSEWOOD)
    await screen.findByText(/ by name or room$/)
    return document.body.textContent ?? ''
  }

  it('names the subject in the heading, the search and the landmark', async () => {
    const said = await openPicker(OTHER)
    expect(said).toContain('Your people supported')
    expect(said).toContain('Search people supported by name or room')
    expect(said).not.toContain('Your residents')
    expect(
      screen.getByRole('list', { name: 'People supported you can write about' }),
    ).toBeTruthy()
  })

  /*
   * A count beside the plural, through `pluralise` so the two agree: "None of
   * the 9 people supported you can write about…". Built by hand it would read
   * "person supporteds", which is the case that proves the plural is declared.
   */
  it('agrees a count with the plural in the empty-search sentence', async () => {
    const m = await loadUnder(OTHER)
    const user = (await import('@testing-library/user-event')).default.setup()
    m.renderSignedIn(m.staffAkinyemi.id, <m.ResidentPickerRoute />, ROSEWOOD)
    const search = await screen.findByRole('searchbox')
    await user.type(search, 'zzzzzz')
    const said = document.body.textContent ?? ''
    expect(said).toMatch(/None of the \d+ people supported you can write about/)
    expect(said).not.toMatch(/person supporteds/)
    expect(said).toContain('No person supported matches')
  })
})

describe('a suggested opener', () => {
  /*
   * Product copy the writer finishes, so it takes the term. What it then writes
   * into a note body stays as written — the body is the author's words and is
   * never re-rendered under a later vocabulary.
   */
  it('offers the family term the organisation chose', async () => {
    const m = await loadUnder(OTHER)
    expect(m.SUGGESTED_PHRASES.social_emotional).toContain('Next of kin visited: ')
    expect(m.SUGGESTED_PHRASES.social_emotional).not.toContain('Family visited: ')
  })

  it('offers this build’s own word when nothing is asked for', async () => {
    const m = await loadUnder('')
    expect(m.SUGGESTED_PHRASES.social_emotional).toContain('Family visited: ')
  })
})
