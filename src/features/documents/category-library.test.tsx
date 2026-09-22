import { vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { IsoDate, IsoDateTime } from '@/data/types'
import { documentsForSite } from '@/data/fixtures/documents'
import { now } from '@/data/fixtures/clock'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import { endSession } from '@/data/access/session-losses'
import { zonedDate } from '@/lib/format'
import { DOCUMENT_CATEGORIES } from '@/features/residents/tabs/documents/categories'
import { countExpiry, expiryFinding } from '@/features/residents/tabs/documents/expiry'
import { renderSignedIn } from '@/test/render-signed-in'
import { CategoryLibraryRoute } from './CategoryLibraryRoute'

/**
 * One category of the home's library.
 *
 * The module's hazard is a screen that disagrees with the row a reader
 * followed to reach it. So the four figures here are the row's four figures,
 * counted over the same documents.
 */
const navigation = vi.hoisted(() => ({
  pathname: '/documents/category/health_clinical',
  params: {} as Record<string, string>,
}))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const ROSEWOOD = 'site-rosewood-court' as const
const TODAY: IsoDate = zonedDate(now().toISOString() as IsoDateTime, 'Europe/London')

beforeEach(() => {
  endSession()
})

function open(categoryId: string, staff = staffAkinyemi.id) {
  navigation.pathname = `/documents/category/${categoryId}`
  navigation.params = { categoryId }
  return renderSignedIn(staff, <CategoryLibraryRoute />, ROSEWOOD)
}

const panel = (categoryId: string) =>
  waitFor(() => {
    const found = document.querySelector<HTMLElement>(
      `[data-category-library="${categoryId}"]`,
    )
    expect(found).toBeTruthy()
    return found!
  })

const inCategory = (categoryId: string) =>
  documentsForSite(ROSEWOOD).filter((entry) => entry.category === categoryId)

describe('the documents in a category', () => {
  it('carries the same four figures as the row that led here', async () => {
    open('health_clinical')
    await panel('health_clinical')
    const counts = countExpiry(inCategory('health_clinical'), TODAY)

    const figure = (what: string) =>
      document.querySelector(`[data-category-figures] [data-figure="${what}"]`)
        ?.textContent ?? ''
    expect(figure('total')).toBe(`${counts.total}on file`)
    expect(figure('expired')).toBe(`${counts.expired}expired`)
    expect(figure('expiring')).toBe(`${counts.expiring}expiring within 30 days`)
    expect(
      document.querySelector('[data-category-figures] [data-not-recorded]')
        ?.textContent,
    ).toContain('with no expiry recorded')
  })

  it('lists only this category, expired first, and opens each one', async () => {
    open('health_clinical')
    const found = await panel('health_clinical')
    await waitFor(() =>
      expect(found.querySelectorAll('[data-queue-row]').length).toBeGreaterThan(0),
    )

    const mine = new Set(inCategory('health_clinical').map((entry) => entry.id))
    const rows = [...found.querySelectorAll<HTMLElement>('[data-queue-row]')]
    for (const row of rows) {
      const id = row.getAttribute('data-queue-row')!
      expect(mine.has(id as never), id).toBe(true)
      // Exactly one way in, or a stated reason there is none.
      const opens = row.querySelector('[data-action="open"]')
      const not = row.querySelector('[data-action="not_retrievable"]')
      expect(Boolean(opens) !== Boolean(not), id).toBe(true)
      if (opens !== null) expect(opens.getAttribute('href')).toBe(`/documents/${id}`)
    }

    // Expired first: the order is the finding.
    const kinds = rows.map((row) => {
      const id = row.getAttribute('data-queue-row')
      const document_ = inCategory('health_clinical').find((entry) => entry.id === id)!
      return expiryFinding(document_.expiry, TODAY).kind
    })
    const rank = ['expired', 'expiring', 'not_recorded', 'in_date', 'does_not_expire']
    const ranked = kinds.map((kind) => rank.indexOf(kind))
    expect(ranked).toEqual([...ranked].sort((a, b) => a - b))
  })

  it('says a category nobody has filed in holds nothing, and what it is for', async () => {
    const empty = DOCUMENT_CATEGORIES.find((entry) => inCategory(entry.id).length === 0)
    if (empty === undefined) return
    open(empty.id)
    const found = await panel(empty.id)
    expect(found.querySelector('[data-category-empty]')?.textContent).toContain(
      empty.holds,
    )
    // Empty is not a gap: nothing says a document ought to be here.
    expect(
      found.querySelector('[data-category-empty] [data-state="unrecorded"]'),
    ).toBeNull()
  })
})

describe('an address that is not a category', () => {
  it('says so rather than showing an empty library', async () => {
    open('not_a_category')
    expect(
      await screen.findByText('That is not a category this home files under'),
    ).toBeInTheDocument()
    expect(document.querySelector('[data-queue-row]')).toBeNull()
  })
})

describe('who may read it', () => {
  it('is a read, so a care worker gets the same category', async () => {
    open('health_clinical', staffEze.id)
    const found = await panel('health_clinical')
    await waitFor(() =>
      expect(found.querySelectorAll('[data-queue-row]').length).toBeGreaterThan(0),
    )
    expect(within(found).queryByRole('button', { name: /Upload|File/ })).toBeNull()
  })
})
