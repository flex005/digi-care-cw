import { vi } from 'vitest'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

/**
 * The document library says the organisation's words, possessive included.
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

const navigation = vi.hoisted(() => ({ pathname: '/documents', params: {} }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const ROSEWOOD = 'site-rosewood-court' as const
const OTHER = 'subject:person_supported,admission:placement'

beforeEach(() => {
  vi.resetModules()
})

async function loadUnder(terms: string) {
  vi.resetModules()
  window.history.replaceState(
    null,
    '',
    `/documents?at=09:37${terms === '' ? '' : `&terms=${terms}`}`,
  )
  const [sample, route, people, session, render] = await Promise.all([
    import('./DocumentSample'),
    import('./DocumentsRoute'),
    import('@/data/fixtures/organisation'),
    import('@/data/access/session-losses'),
    import('@/test/render-signed-in'),
  ])
  session.endSession()
  return {
    DocumentSample: sample.DocumentSample,
    DocumentsRoute: route.DocumentsRoute,
    staffAkinyemi: people.staffAkinyemi,
    renderSignedIn: render.renderSignedIn,
  }
}

describe('the library', () => {
  async function open(terms: string) {
    const m = await loadUnder(terms)
    m.renderSignedIn(m.staffAkinyemi.id, <m.DocumentsRoute />, ROSEWOOD)
    await screen.findByText(/and the home’s own/)
    return document.body.textContent ?? ''
  }

  /*
   * **This asserted the defect, and could only ever have agreed with it.**
   * The line read "the ${…many}’ documents", a plural possessive built at the
   * call site, and this test was written to match it — the same assumption in
   * two places, which is what makes an assertion unable to disagree. It was
   * found by reading the rendered string back and asking what it says under
   * every term: "the people supported’ documents", under the one term the six
   * declared forms exist because of.
   *
   * The sentence is reworded, so the assertion is that **no apostrophe follows
   * the plural at all** — which fails if the possessive comes back in any of
   * its shapes.
   */
  it('names whose documents these are without building a possessive', async () => {
    const said = await open(OTHER)
    expect(said).toContain(
      'documents held for the people supported, and the home’s own',
    )
    expect(said).not.toMatch(/people supported[’']s? documents/)
    expect(said).not.toContain('the residents’ documents')
  })

  /*
   * **Every subject vocabulary, rendered rather than reasoned about.** Four of
   * the thirty-five declared plurals do not end in s — "people supported",
   * "staff", "care staff", "next of kin" — and one of them is a subject term,
   * which is what made the possessive wrong here rather than merely fragile.
   */
  it.each([
    ['', 'residents'],
    ['subject:service_user', 'service users'],
    ['subject:person_supported', 'people supported'],
    ['org:hospital', 'patients'],
  ])('reads the same way under %s', async (terms, plural) => {
    const said = await open(terms)
    expect(said).toContain(`documents held for the ${plural}, and the home’s own`)
    expect(said).not.toMatch(/[’']s? documents/)
  })

  /*
   * The sample a reader opens, which says whose record a document sits on and
   * what the home holds it for. Rendered directly: the placeholder in the
   * upload dialog says the same word and takes two clicks to reach.
   */
  it('names the subject on the document it draws', async () => {
    const m = await loadUnder(OTHER)
    const fixtures = await import('@/data/fixtures/documents')
    const document_ = fixtures.documents.find(
      (entry) => entry.category === 'correspondence',
    )!
    expect(document_, 'no correspondence document in the fixtures').toBeTruthy()
    m.renderSignedIn(
      m.staffAkinyemi.id,
      <m.DocumentSample document={document_} resident={undefined} />,
      ROSEWOOD,
    )
    const said = document.body.textContent ?? ''
    expect(said).toContain('Retain in the person supported record')
    expect(said).not.toContain('Retain in the resident record')
  })

  it('says this build’s own words when nothing is asked for', async () => {
    const said = await open('')
    expect(said).toContain('documents held for the residents, and the home’s own')
    expect(said).not.toContain('people supported')
  })
})
