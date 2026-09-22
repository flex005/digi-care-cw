import { vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { DocumentId } from '@/data/types'
import { documents } from '@/data/fixtures/documents'
import { residents } from '@/data/fixtures/residents'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import { endSession } from '@/data/access/session-losses'
import { renderSignedIn } from '@/test/render-signed-in'
import { DocumentViewerRoute } from './DocumentViewerRoute'
import { documentReferrers } from './referrers'

/**
 * Opening a document. DOC-01.
 *
 * The module's hazard is a viewer that looks like the document it cannot
 * produce. So: the banner says what the page is, the metadata on it is the
 * real metadata, and the panel beside it answers the question that makes the
 * screen worth opening — what would break if this document went.
 */
const navigation = vi.hoisted(() => ({
  pathname: '/documents/doc-lib-0001',
  params: {} as Record<string, string>,
}))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const ROSEWOOD = 'site-rosewood-court' as const

beforeEach(() => {
  endSession()
})

function open(documentId: string, staff = staffAkinyemi.id) {
  navigation.pathname = `/documents/${documentId}`
  navigation.params = { documentId }
  return renderSignedIn(staff, <DocumentViewerRoute />, ROSEWOOD)
}

const onFile = documents.find((entry) => entry.file.kind !== 'not_retrievable')!

describe('the sample', () => {
  it('says it is a sample, above the page rather than across it', async () => {
    open(onFile.id)
    await screen.findByText(/This is a sample document/)
    const banner = document.querySelector('[data-sample-banner]')
    const sample = document.querySelector('[data-document-sample]')
    expect(banner?.textContent).toMatch(/no file is stored behind this record/)
    // Above it in the document, never over it: the sample stays readable.
    expect(sample).not.toBeNull()
    expect(banner!.compareDocumentPosition(sample!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })

  it('carries the real metadata, because the metadata is what is real', async () => {
    const owned = documents.find(
      (entry) =>
        entry.owner.kind === 'resident' && entry.file.kind !== 'not_retrievable',
    )!
    const owner = owned.owner
    if (owner.kind !== 'resident') throw new Error('needs a resident’s document')
    const resident = residents.find((entry) => entry.id === owner.residentId)!

    open(owned.id)
    const sample = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-document-sample]')
      expect(found).toBeTruthy()
      return found!
    })
    expect(sample.textContent).toContain(resident.fullLegalName)
    expect(sample.textContent).toContain(owned.filedBy.displayName)
  })
})

describe('what points at this document', () => {
  it('links every record that relies on it, and says what would break', async () => {
    const referenced = documents.find(
      (entry) => documentReferrers(entry.id as DocumentId, residents).length > 0,
    )
    if (referenced === undefined) throw new Error('No document is referenced')
    const expected = documentReferrers(referenced.id as DocumentId, residents)

    open(referenced.id)
    await screen.findByText(/This is a sample document/)

    const drawn = [...document.querySelectorAll('[data-referrer]')].map((row) =>
      row.getAttribute('data-referrer'),
    )
    expect(drawn).toEqual(expected.map((entry) => entry.href))
    expect(document.querySelector('[data-referrer-count]')?.textContent).toMatch(
      /would render as a broken reference/,
    )
  })

  /*
   * Zero is an answer, and a different one from a broken reference: nothing
   * relies on this document, so removing it would take evidence away from no
   * record. A plain statement, never the hatch — the hatch would claim nobody
   * had looked.
   */
  it('says plainly where nothing points at it, and spends no hatch on that', async () => {
    const unreferenced = documents.find(
      (entry) =>
        entry.file.kind !== 'not_retrievable' &&
        documentReferrers(entry.id as DocumentId, residents).length === 0,
    )!
    open(unreferenced.id)

    const said = await waitFor(() => {
      const found = document.querySelector('[data-no-referrers]')
      expect(found).toBeTruthy()
      return found!
    })
    expect(said.textContent).toMatch(/No record in this build points at this document/)
    expect(said.closest('[data-state="unrecorded"]')).toBeNull()
  })
})

describe('an address that holds nothing', () => {
  it('says so rather than inventing a page to fill it', async () => {
    open('doc-does-not-exist')
    expect(
      await screen.findByText('No document on file has that reference'),
    ).toBeInTheDocument()
    expect(document.querySelector('[data-document-sample]')).toBeNull()
  })
})

describe('who may open one', () => {
  it('opens for a care worker, because opening a document is reading it', async () => {
    open(onFile.id, staffEze.id)
    expect(await screen.findByText(/This is a sample document/)).toBeInTheDocument()
    // Read-only: nothing on the screen writes.
    const viewer = document.querySelector<HTMLElement>('[data-document-viewer]')!
    expect(within(viewer).queryByRole('button')).toBeNull()
  })
})
