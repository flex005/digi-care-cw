import { vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import { endSession } from '@/data/access/session-losses'
import { renderSignedIn } from '@/test/render-signed-in'
import { DOCUMENT_CATEGORIES } from '@/features/residents/tabs/documents/categories'
import { DocumentsRoute } from './DocumentsRoute'

const navigation = vi.hoisted(() => ({ pathname: '/documents', params: {} }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const ROSEWOOD = 'site-rosewood-court' as const

beforeEach(() => {
  endSession()
})

async function openList(id = staffAkinyemi.id) {
  const rendered = renderSignedIn(id, <DocumentsRoute />, ROSEWOOD)
  await screen.findByRole('heading', { level: 1, name: 'Documents' })
  await screen.findByText('By category')
  return rendered
}

const category = (id: string) =>
  document.querySelector<HTMLElement>(`[data-category="${id}"]`)!

describe('the lead figure', () => {
  /*
   * DOC-01 leads on coverage rather than on a count of expired documents: a
   * home that knows ten have lapsed is in better shape than one that cannot
   * say, because the first has a finding and the second has no way to have one.
   */
  it('is the share carrying an expiry decision, with its parts beside it', async () => {
    await openList()
    const said = document.body.textContent ?? ''
    expect(said).toMatch(/77%/)
    expect(said).toMatch(/237/)
    expect(said).toMatch(/306/)
  })

  it('says what an expiry decision is made of', async () => {
    await openList()
    expect(
      screen.getByText(
        /Either a date, or somebody recording that the document does not expire/,
      ),
    ).toBeTruthy()
  })
})

describe('the categories', () => {
  it('lists all seven, including the ones DOC-01 does not illustrate', async () => {
    await openList()
    for (const entry of DOCUMENT_CATEGORIES) expect(category(entry.id)).not.toBeNull()
    expect(document.querySelectorAll('[data-category]')).toHaveLength(7)
  })

  it('draws DOC-01’s three rows with DOC-01’s own counts', async () => {
    await openList()
    const health = category('health_clinical')
    expect(within(health).getByText(/109/)).toBeTruthy()
    expect(within(health).getByText(/10 expired/)).toBeTruthy()
    expect(within(health).getByText(/5 expiring within 30 days/)).toBeTruthy()
    expect(within(health).getByText(/21 with no expiry recorded/)).toBeTruthy()

    const plans = category('assessments_care_planning')
    expect(within(plans).getByText(/9 with no expiry recorded/)).toBeTruthy()

    const consents = category('consent_records')
    expect(within(consents).getByText(/4 with no expiry recorded/)).toBeTruthy()
  })

  /*
   * Two of the three are findings about documents somebody decided on; the
   * third is the absence of that decision. It takes the hatch, they take
   * critical and caution, and nothing on the row adds them together.
   */
  it('hatches the no-expiry count and never hatches the expired one', async () => {
    await openList()
    const health = category('health_clinical')
    const hatched = health.querySelectorAll('[data-state="unrecorded"]')
    expect(hatched).toHaveLength(1)
    expect(hatched[0]?.textContent).toMatch(/21 with no expiry recorded/)

    const expired = within(health)
      .getByText(/10 expired/)
      .closest('[data-tone]')
    expect(expired?.getAttribute('data-tone')).toBe('critical')
    expect(expired?.getAttribute('data-state')).toBe('recorded')
  })

  it('says a category holds nothing rather than leaving the heading out', async () => {
    await openList()
    for (const entry of DOCUMENT_CATEGORIES) {
      const row = category(entry.id)
      expect(row.textContent).toMatch(/It holds /)
      expect(row.textContent).toMatch(/on file/)
    }
  })
})

describe('who may file a document', () => {
  it('refuses a care worker once, and leaves the library readable', async () => {
    await openList(staffEze.id)
    const points = document.querySelectorAll('[data-answer]')
    expect(points).toHaveLength(1)
    expect(points[0]?.getAttribute('data-answer')).toBe('not_your_role')
    expect(document.querySelector('[data-upload-document]')).toBeNull()
    expect(document.querySelectorAll('[data-category]')).toHaveLength(7)
  })

  it('sends a senior carer to the resident the document is about', async () => {
    await openList(staffAkinyemi.id)
    expect(document.querySelectorAll('[data-answer]')).toHaveLength(0)
    // DOC-01 puts the act top right, and a document belongs to somebody.
    const link = document.querySelector('[data-upload-document]')
    expect(link?.getAttribute('href')).toBe('/residents')
  })
})
