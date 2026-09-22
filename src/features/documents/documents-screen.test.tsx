import { vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  /** The figure and its own label, read as one, whichever column it is in. */
  const figureIn = (row: HTMLElement, what: string) =>
    row.querySelector(`[data-figure="${what}"]`)?.textContent ?? ''

  it('draws DOC-01’s three rows with DOC-01’s own counts', async () => {
    await openList()
    const health = category('health_clinical')
    expect(figureIn(health, 'total')).toBe('109on file')
    expect(figureIn(health, 'expired')).toBe('10expired')
    expect(figureIn(health, 'expiring')).toBe('5expiring within 30 days')
    expect(within(health).getByText(/21 with no expiry recorded/)).toBeTruthy()

    const plans = category('assessments_care_planning')
    expect(within(plans).getByText(/9 with no expiry recorded/)).toBeTruthy()

    const consents = category('consent_records')
    expect(within(consents).getByText(/4 with no expiry recorded/)).toBeTruthy()
  })

  /*
   * The order is the finding, and the subtitle says which order it is. A
   * heading claiming one order over a list in another is a screen telling a
   * reader something it is not doing.
   */
  it('orders the rows by what needs attention soonest, and says so', async () => {
    await openList()
    const urgency = [...document.querySelectorAll('[data-category]')].map((row) => {
      const of = (what: string) =>
        Number(row.querySelector(`[data-figure="${what}"] [data-numeric]`)?.textContent)
      return of('expired') + of('expiring')
    })
    expect(urgency).toEqual([...urgency].sort((a, b) => b - a))
    expect(screen.getByText(/most in need of attention first/)).toBeTruthy()
  })

  /*
   * A zero is a finding, not a gap. Every row carries all four figures in the
   * same place, so a category with nothing wrong is distinguishable from a
   * category the row stopped talking about — and the eye can run down one
   * column without reading a word.
   */
  it('draws all four figures on every row, zeroes included', async () => {
    await openList()
    for (const entry of DOCUMENT_CATEGORIES) {
      const row = category(entry.id)
      for (const what of ['total', 'expired', 'expiring']) {
        expect(
          row.querySelector(`[data-figure="${what}"]`),
          `${entry.id}/${what}`,
        ).not.toBeNull()
      }
      // The fourth is a figure or the hatch, and exactly one of the two.
      const gap = row.querySelector('[data-not-recorded]')
      expect(gap?.textContent, entry.id).toMatch(/with no expiry recorded/)
    }
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

    // The expired count is a finding somebody recorded, so it never hatches.
    const expired = health.querySelector('[data-figure="expired"]')
    expect(expired?.textContent).toBe('10expired')
    expect(expired?.closest('[data-state="unrecorded"]')).toBeNull()
  })

  it('lists every category, including the ones holding nothing', async () => {
    await openList()
    expect(document.querySelectorAll('[data-category]')).toHaveLength(
      DOCUMENT_CATEGORIES.length,
    )
    for (const entry of DOCUMENT_CATEGORIES) {
      const row = category(entry.id)
      expect(row.textContent, entry.id).toContain(entry.label)
      expect(row.textContent, entry.id).toMatch(/on file/)
    }
  })

  /*
   * A count is not the end of the road: the row says a category holds 109
   * documents, and the name opens the 109. Without it a reader who wanted a
   * clinical letter had to know whose record it was on.
   */
  it('opens every category from its own name', async () => {
    await openList()
    for (const entry of DOCUMENT_CATEGORIES) {
      const link = category(entry.id).querySelector(
        `[data-open-category="${entry.id}"]`,
      )
      expect(link?.getAttribute('href'), entry.id).toBe(
        `/documents/category/${entry.id}`,
      )
      expect(link?.textContent, entry.id).toContain(entry.label)
    }
  })
})

describe('who may file a document', () => {
  it('offers a care worker no filing, and leaves the library readable', async () => {
    await openList(staffEze.id)
    expect(document.querySelectorAll('[data-answer]')).toHaveLength(0)
    expect(document.querySelector('[data-act-line]')).toBeNull()
    expect(document.querySelector('[data-upload-document]')).toBeNull()
    expect(document.querySelectorAll('[data-category]')).toHaveLength(7)
  })

  /*
   * DOC-01 puts "Expiry tracking >" top right beside the upload, and it is a
   * read, so both roles get it.
   */
  it('offers expiry tracking to both roles, from the top of the library', async () => {
    for (const staff of [staffAkinyemi, staffEze]) {
      const { unmount } = await openList(staff.id)
      const link = document.querySelector('[data-expiry-link]')
      expect(link?.getAttribute('href'), staff.id).toBe('/documents/expiry')
      unmount()
    }
  })

  /*
   * DOC-01 puts the act top right, and a document belongs to somebody — so the
   * dialog asks who before it draws a form, and draws no form until it has an
   * answer (CLAUDE.md §2).
   */
  it('asks a senior carer who the document is about, over the library', async () => {
    const user = userEvent.setup()
    await openList(staffAkinyemi.id)
    expect(document.querySelectorAll('[data-answer]')).toHaveLength(0)

    const act = document.querySelector<HTMLElement>('[data-upload-document]')
    expect(act?.tagName).toBe('BUTTON')
    await user.click(act!)

    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByRole('combobox', { name: 'Who the document is about' }),
    ).toBeInTheDocument()
    // Nothing to fill in until somebody is chosen.
    expect(within(dialog).queryByLabelText('Title')).toBeNull()

    await user.click(
      within(dialog).getByRole('combobox', { name: 'Who the document is about' }),
    )
    const [first] = await screen.findAllByRole('option')
    await user.click(first!)

    expect(await within(dialog).findByLabelText('Title')).toBeInTheDocument()
    expect(dialog.querySelector('[data-subject-strip]')).not.toBeNull()
  })
})
