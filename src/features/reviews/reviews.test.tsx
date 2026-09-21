import { vi } from 'vitest'

vi.hoisted(() => {
  window.history.replaceState(null, '', '/reviews?at=20:20')
})

import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ResidentId } from '@/data/types'
import { residentsBySite } from '@/data/fixtures/residents'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import {
  resetSessionWholePlanReviews,
  withSessionWholePlanReview,
} from '@/data/access/whole-plan-review-store'
import { endSession } from '@/data/access/session-losses'
import { renderSignedIn } from '@/test/render-signed-in'
import { ReviewQueueRoute } from './ReviewQueueRoute'
import { WholePlanReviewRoute } from './WholePlanReviewRoute'
import { byLongestOverdue, isOwed, standingOf, type ReviewRow } from './review-queue'

const navigation = vi.hoisted(() => ({
  pathname: '/reviews',
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
  resetSessionWholePlanReviews()
  navigation.params = {}
})

const rows = (): ReviewRow[] =>
  residentsBySite(ROSEWOOD).map((resident) => ({
    resident,
    standing: standingOf(resident.carePlanReview),
  }))

async function openQueue(id = staffAkinyemi.id) {
  const user = userEvent.setup()
  const rendered = renderSignedIn(id, <ReviewQueueRoute />, ROSEWOOD)
  await screen.findByRole('group', { name: 'Which residents' })
  return { user, ...rendered }
}

async function openReview(residentId: ResidentId, id = staffAkinyemi.id) {
  navigation.pathname = `/residents/${residentId}/care-plan/review`
  navigation.params = { residentId }
  const user = userEvent.setup()
  const rendered = renderSignedIn(id, <WholePlanReviewRoute />, ROSEWOOD)
  await screen.findByRole('heading', { level: 1 })
  return { user, ...rendered }
}

describe('the queue’s rules', () => {
  it('counts a resident nobody has scheduled as owed one', () => {
    expect(isOwed({ kind: 'never_scheduled' })).toBe(true)
    expect(isOwed({ kind: 'due', dueOn: '2026-09-18' })).toBe(true)
    expect(isOwed({ kind: 'overdue', dueOn: '2026-08-01', daysOverdue: 48 })).toBe(true)
    expect(isOwed({ kind: 'scheduled', dueOn: '2026-12-01' })).toBe(false)
  })

  it('puts the longest overdue first and the unscheduled after the dated ones', () => {
    const ordered = byLongestOverdue([
      {
        resident: { fullLegalName: 'B' } as never,
        standing: { kind: 'never_scheduled' },
      },
      {
        resident: { fullLegalName: 'A' } as never,
        standing: { kind: 'overdue', dueOn: '2026-08-01', daysOverdue: 10 },
      },
      {
        resident: { fullLegalName: 'C' } as never,
        standing: { kind: 'overdue', dueOn: '2026-07-01', daysOverdue: 80 },
      },
      {
        resident: { fullLegalName: 'D' } as never,
        standing: { kind: 'due', dueOn: '2026-09-18' },
      },
    ])
    expect(ordered.map((row) => row.standing.kind)).toEqual([
      'overdue',
      'overdue',
      'due',
      'never_scheduled',
    ])
    expect(
      ordered[0]!.standing.kind === 'overdue' ? ordered[0]!.standing.daysOverdue : 0,
    ).toBe(80)
  })
})

describe('the queue', () => {
  it('counts who is owed one over everybody at the home, and names the unscheduled', async () => {
    await openQueue()
    const owed = rows().filter((row) => isOwed(row.standing))
    const banner = document.querySelector('[data-reviews-banner]')?.closest('section')
    expect(banner?.textContent).toContain(String(owed.length))
    expect(banner?.textContent).toContain(
      `of ${rows().length} residents at Rosewood Court`,
    )
    expect(banner?.textContent).toMatch(/have no review date at all/)
  })

  it('gives a senior carer the way in to each review', async () => {
    await openQueue()
    expect(document.querySelectorAll('[data-open-review]').length).toBeGreaterThan(0)
    expect(document.querySelector('[data-act-line]')).toBeNull()
  })

  it('gives a care worker the queue to read and no way into a review', async () => {
    await openQueue(staffEze.id)
    expect(document.querySelectorAll('[data-act-line]')).toHaveLength(0)
    expect(document.body.textContent).not.toContain(
      'Conducting a review is for a senior carer.',
    )
    expect(document.querySelector('[data-open-review]')).toBeNull()
  })
})

describe('the review itself', () => {
  const someone = () => {
    const owed = rows().find((row) => isOwed(row.standing))
    if (owed === undefined) throw new Error('Nobody at Rosewood is owed a review')
    return owed.resident
  }

  it('names every domain that would be carried as a gap', async () => {
    const resident = someone()
    await openReview(resident.id)
    const store = document.querySelector('[data-will-store]')
    const outstanding = [...document.querySelectorAll('[data-outstanding-domain]')]
    if (store === null) {
      // A plan with nothing outstanding says so rather than showing an empty list.
      expect(document.querySelector('[data-outstanding="0"]')).not.toBeNull()
    } else {
      expect(outstanding.length).toBe(Number(store.getAttribute('data-will-store')))
      expect(store.textContent).toMatch(/carries what was outstanding when you signed/)
    }
  })

  it('draws no notice about what this build does not keep', async () => {
    await openReview(someone().id)
    expect(document.querySelector('[data-act-line]')).toBeNull()
  })

  it('records the review with what was outstanding, and nothing is sent', async () => {
    const resident = someone()
    const { user } = await openReview(resident.id)
    const outstanding = document.querySelectorAll('[data-outstanding-domain]').length

    await user.click(screen.getByRole('button', { name: /^Complete the review for / }))

    await waitFor(() => {
      const after = withSessionWholePlanReview(resident)
      expect(after.carePlanReview.kind).toBe('completed')
    })
    const after = withSessionWholePlanReview(resident).carePlanReview
    if (after.kind !== 'completed') throw new Error('not completed')
    expect(after.completedBy.id).toBe(staffAkinyemi.id)
    expect(
      after.outstanding.kind === 'outstanding' ? after.outstanding.domains.length : 0,
    ).toBe(outstanding)

    await waitFor(() =>
      expect(document.querySelector('[data-review-done]')?.textContent).toMatch(
        /nothing was sent\.$/,
      ),
    )
  })

  it('offers a care worker nothing to complete, and no reason either', async () => {
    await openReview(someone().id, staffEze.id)
    expect(document.querySelector('[data-act-line]')).toBeNull()
    expect(document.body.textContent).not.toContain(
      'Conducting a review is for a senior carer.',
    )
    expect(
      screen.queryByRole('button', { name: /^Complete the review for / }),
    ).toBeNull()
  })
})
