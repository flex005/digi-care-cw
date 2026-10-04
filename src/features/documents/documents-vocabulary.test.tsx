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
    await screen.findByText(/documents and the home’s own/)
    return document.body.textContent ?? ''
  }

  /** The subject plural possessive, which no other module needed. */
  it('names whose documents these are, in the plural', async () => {
    const said = await open(OTHER)
    expect(said).toContain('the people supported’ documents and the home’s own')
    expect(said).not.toContain('the residents’ documents')
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
    expect(said).toContain('the residents’ documents and the home’s own')
  })
})
