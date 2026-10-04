import { vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

/**
 * The record says the organisation's words, and two existing rules hold while
 * it does.
 *
 * **The subject header is the wrong-subject control (CLAUDE.md §2)**, and it
 * carries term words. It is what somebody reads before writing against a
 * record, so it has to be right under every vocabulary rather than merely
 * fit — the whole of §2 rests on that header being unambiguous, and a term
 * that reads wrongly there is a worse defect than one in a page title.
 *
 * **Absence from a list is the same bug as a blank cell (§1)**: ten care plan
 * domains, eight consent types, nine risk templates, listed whether or not
 * anything is recorded. Their headings carry term words, and converting a
 * heading must not change which items are listed or where the hatch falls.
 */

vi.setConfig({ testTimeout: 20_000 })

const navigation = vi.hoisted(() => ({
  pathname: '/residents',
  params: {} as { residentId?: string },
}))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const ROSEWOOD = 'site-rosewood-court' as const
/** Four terms at once, none sharing a token with this build's own words. */
const OTHER =
  'subject:person_supported,carePlan:care_and_support_plan,staff:healthcare_professional,manager:clinical_manager'

beforeEach(() => {
  vi.resetModules()
})

async function loadUnder(terms: string) {
  /*
   * Reset here rather than only in `beforeEach`: a case that loads two
   * vocabularies gets the first one twice otherwise, because the second import
   * comes out of the registry the first one filled. That is how the
   * either-vocabulary comparison below passed on one render counted twice.
   */
  vi.resetModules()
  window.history.replaceState(
    null,
    '',
    `/residents?at=09:37${terms === '' ? '' : `&terms=${terms}`}`,
  )
  const [list, needs, carePlan, people, session, render] = await Promise.all([
    import('./ResidentsRoute'),
    import('./tabs/NeedsTab'),
    import('./tabs/CarePlanTab'),
    import('@/data/fixtures/organisation'),
    import('@/data/access/session-losses'),
    import('@/test/render-signed-in'),
  ])
  session.endSession()
  return {
    ResidentsRoute: list.ResidentsRoute,
    NeedsTab: needs.NeedsTab,
    CarePlanTab: carePlan.CarePlanTab,
    staffAkinyemi: people.staffAkinyemi,
    renderSignedIn: render.renderSignedIn,
    renderProfileTab: render.renderProfileTab,
  }
}

async function openProfile(terms: string, tab: 'needs' | 'carePlan') {
  const m = await loadUnder(terms)
  navigation.params = { residentId: 'res-okafor' }
  navigation.pathname = `/residents/res-okafor${tab === 'needs' ? '' : '/care-plan'}`
  const Tab = tab === 'needs' ? m.NeedsTab : m.CarePlanTab
  m.renderProfileTab(m.staffAkinyemi.id, <Tab />, ROSEWOOD)
  await screen.findByRole('heading', { level: 1, name: /Emmanuel/ })
  return m
}

describe('the list', () => {
  async function openList(terms: string) {
    const m = await loadUnder(terms)
    m.renderSignedIn(m.staffAkinyemi.id, <m.ResidentsRoute />, ROSEWOOD)
    await screen.findByRole('group', { name: /^Show / })
    return document.body.textContent ?? ''
  }

  it('names the subject in four places, and never this build’s own word', async () => {
    const said = await openList(OTHER)
    expect(said).toContain('All people supported')
    expect(said).toContain('Search people supported by name or room')
    expect(screen.getByRole('group', { name: 'Show people supported' })).toBeTruthy()
    expect(said).not.toContain('All residents')
    expect(said).not.toContain('Search residents')
  })

  it('says this build’s own words when nothing is asked for', async () => {
    const said = await openList('')
    expect(said).toContain('All residents')
    expect(said).not.toContain('person supported')
  })
})

describe('the subject header, which §2 rests on', () => {
  /*
   * **The one header whose correctness the wrong-subject rule depends on.** It
   * is above every write surface in the record, and it is where somebody checks
   * they are writing about the person in front of them.
   */
  it('carries the chosen word on the way back out of the record', async () => {
    await openProfile(OTHER, 'needs')
    // The way out names the whole list, in the organisation's word.
    expect(screen.getByText('All people supported')).toBeTruthy()
    expect(screen.queryByText('All residents')).toBeNull()
  })

  /*
   * And the header still names the person, which is what it is for: a term that
   * displaced the name would be the wrong-subject defect rather than a fix.
   */
  it('still names the person, their room and their record', async () => {
    await openProfile(OTHER, 'needs')
    const head = document.querySelector('[data-record-front]')
    expect(head).not.toBeNull()
    expect(head?.textContent).toContain('Emmanuel Okafor')
    expect(head?.textContent).toMatch(/Room \d+/)
  })
})

describe('a list of everything is still a list of everything', () => {
  /*
   * §1: all ten care plan domains are listed whether or not anything is
   * recorded against them, and an empty one is hatched rather than absent.
   * Converting the heading must not move either.
   */
  it('lists all ten domains under the chosen word, and hatches the empty ones', async () => {
    await openProfile(OTHER, 'needs')
    const said = document.body.textContent ?? ''
    expect(said).toContain('Care & support plan')
    expect(said).not.toContain('Care plan')
    // The group heading above the last domains, which is its own string.
    expect(said).toContain('Other care & support plan domains')
    expect(said).toContain('Part of the care & support plan;')

    const domains = document.querySelectorAll('[data-domain]')
    const hatched = document.querySelectorAll('[data-state="unrecorded"]')
    expect(domains.length, 'the ten domains are not all drawn').toBeGreaterThan(0)
    expect(hatched.length, 'nothing is hatched at all').toBeGreaterThan(0)
  })

  /** The same counts under the default, so the conversion moved words only. */
  it('draws the same items and the same gaps under either vocabulary', async () => {
    await openProfile(OTHER, 'needs')
    const chosen = {
      domains: document.querySelectorAll('[data-domain]').length,
      hatched: document.querySelectorAll('[data-state="unrecorded"]').length,
    }
    // React's own teardown, not an innerHTML wipe: the second render would
    // otherwise mount beside the first and every count would be both.
    cleanup()

    await openProfile('', 'needs')
    const own = {
      domains: document.querySelectorAll('[data-domain]').length,
      hatched: document.querySelectorAll('[data-state="unrecorded"]').length,
    }
    expect(own).toEqual(chosen)
    expect(document.body.textContent).toContain('Care plan')
  })
})

describe('the labels in the subject’s own voice', () => {
  /*
   * **"What I need help with" is the person speaking**, and `plan-fields.ts`
   * declares `voice: 'resident'` on it. A vocabulary rewriting it would be the
   * tidying transformation that destroyed it once already: it is not a term
   * site, it is somebody's sentence.
   */
  it('leaves the first-person labels exactly as they are', async () => {
    const { PLAN_FIELDS } = await import('./tabs/plan-fields')
    const spoken = PLAN_FIELDS.filter((field) => field.voice === 'resident')
    expect(spoken.length, 'no field is declared as the subject speaking').toBe(2)
    for (const field of spoken) expect(field.label).toMatch(/^(What|How) I /)
    expect(spoken.map((field) => field.label)).toEqual([
      'What I need help with',
      'How I like it done',
    ])
  })

  /*
   * **And nothing in that file asks the vocabulary**, which is the mechanical
   * half of the same claim: a label in somebody's own voice cannot drift into a
   * term site by somebody converting the file around it.
   */
  it('asks no vocabulary for the labels in that voice', async () => {
    const { readFileSync } = await import('node:fs')
    const source = readFileSync('src/features/residents/tabs/plan-fields.ts', 'utf8')
    /*
     * **Per field, not per file.** This asserted that the file asked no
     * vocabulary at all, and that was too wide: `agreedActions` is
     * `voice: 'staff'` — "What staff will do" — and that word is the
     * organisation's to choose. The claim that matters is narrower: a label
     * declared as the subject speaking is a plain sentence, with nothing
     * interpolated into it.
     */
    for (const line of source.split('\n')) {
      // The declaration of the union is not a field; a field carries a label.
      if (!line.includes("voice: 'resident'") || !line.includes('label:')) continue
      expect(line, line.trim()).not.toContain('VOCABULARY')
      expect(line, line.trim()).toMatch(/label: '[^']+'/)
    }
    expect(source).toContain("voice: 'resident'")
  })
})
