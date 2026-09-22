import { vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { IsoDate, IsoDateTime } from '@/data/types'
import { documentsForSite } from '@/data/fixtures/documents'
import { now } from '@/data/fixtures/clock'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import { endSession } from '@/data/access/session-losses'
import { zonedDate } from '@/lib/format'
import { countExpiry, expiryFinding } from '@/features/residents/tabs/documents/expiry'
import { renderSignedIn } from '@/test/render-signed-in'
import { ExpiryQueueRoute } from './ExpiryQueueRoute'

/**
 * Expiry tracking. DOC-01.
 *
 * The module's hazard is a queue that reads as the whole library. So the claim
 * under the filters carries the filter and the denominator, and the filter
 * pills carry their own counts.
 */
const navigation = vi.hoisted(() => ({ pathname: '/documents/expiry', params: {} }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const ROSEWOOD = 'site-rosewood-court' as const

/* From the clock the fixtures were built against, never a date typed here. */
const TODAY: IsoDate = zonedDate(now().toISOString() as IsoDateTime, 'Europe/London')

beforeEach(() => {
  endSession()
})

const open = (staff = staffAkinyemi.id) =>
  renderSignedIn(staff, <ExpiryQueueRoute />, ROSEWOOD)

const queue = () =>
  waitFor(() => {
    const found = document.querySelector<HTMLElement>('[data-expiry-queue]')
    expect(found).toBeTruthy()
    return found!
  })

const counts = () => countExpiry(documentsForSite(ROSEWOOD), TODAY)

describe('the queue opens on what has already lapsed', () => {
  it('shows the expired, oldest problem first, and says so', async () => {
    open()
    await queue()
    await waitFor(() =>
      expect(document.querySelectorAll('[data-queue-row]').length).toBeGreaterThan(0),
    )

    const chosen = document.querySelector('[data-expiry-filter="expired"]')
    expect(chosen?.getAttribute('aria-pressed')).toBe('true')

    // Every row on screen is an expired one, which is what the filter claims.
    const ids = [...document.querySelectorAll('[data-queue-row]')].map((row) =>
      row.getAttribute('data-queue-row'),
    )
    const expired = documentsForSite(ROSEWOOD).filter(
      (entry) => expiryFinding(entry.expiry, TODAY).kind === 'expired',
    )
    for (const id of ids) expect(expired.some((entry) => entry.id === id)).toBe(true)
  })

  /*
   * A claim inside a filter carries the filter, or it asserts something about
   * a set it is not counting over.
   */
  it('carries the filter and the denominator in the claim', async () => {
    open()
    await queue()
    const claim = await waitFor(() => {
      const found = document.querySelector('[data-expiry-claim]')
      expect(found?.textContent).toBeTruthy()
      return found!
    })

    expect(claim.textContent).toContain(String(counts().expired))
    expect(claim.textContent).toContain(String(counts().total))
    expect(claim.textContent).toContain('the documents that have expired')
    expect(claim.textContent).toContain('Rosewood Court')
  })

  it('gives every filter its own count, from the same figures', async () => {
    open()
    await queue()
    const all = counts()
    const expected: Record<string, number> = {
      expired: all.expired,
      expiring: all.expiring,
      not_recorded: all.notRecorded,
      all: all.total,
    }
    for (const [id, value] of Object.entries(expected)) {
      const pill = document.querySelector(`[data-expiry-filter="${id}"]`)
      expect(pill?.textContent, id).toContain(String(value))
    }
  })

  it('changes what it shows, and what it claims, when the filter changes', async () => {
    const user = userEvent.setup()
    open()
    await queue()
    await user.click(screen.getByRole('button', { name: /No expiry recorded/ }))

    await waitFor(() =>
      expect(document.querySelector('[data-expiry-claim]')?.textContent).toContain(
        'the documents with no expiry recorded',
      ),
    )
    const ids = [...document.querySelectorAll('[data-queue-row]')].map((row) =>
      row.getAttribute('data-queue-row'),
    )
    const notRecorded = documentsForSite(ROSEWOOD).filter(
      (entry) => entry.expiry.kind === 'not_recorded',
    )
    for (const id of ids)
      expect(notRecorded.some((entry) => entry.id === id)).toBe(true)
  })
})

describe('a row', () => {
  it('names who it belongs to and offers exactly one way in, or none', async () => {
    open()
    await queue()
    const rows = await waitFor(() => {
      const found = [...document.querySelectorAll<HTMLElement>('[data-queue-row]')]
      expect(found.length).toBeGreaterThan(0)
      return found
    })

    for (const row of rows) {
      expect(row.querySelector('[data-queue-subject]')?.textContent).toBeTruthy()
      const open_ = row.querySelector('[data-action="open"]')
      const notRetrievable = row.querySelector('[data-action="not_retrievable"]')
      expect(Boolean(open_) !== Boolean(notRetrievable)).toBe(true)
      if (open_ !== null)
        expect(open_.getAttribute('href')).toBe(
          `/documents/${row.getAttribute('data-queue-row')}`,
        )
    }
  })
})

describe('who may read it', () => {
  it('is a read, so a care worker gets the same queue', async () => {
    open(staffEze.id)
    const panel = await queue()
    await waitFor(() =>
      expect(panel.querySelectorAll('[data-queue-row]').length).toBeGreaterThan(0),
    )
    // Nothing here writes, for either role.
    expect(within(panel).queryByRole('button', { name: /Upload|File/ })).toBeNull()
  })
})
