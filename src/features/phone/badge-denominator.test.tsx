import { vi } from 'vitest'

/*
 * **Pinned to a full instant before any fixture loads**: 20:20 BST on
 * 16/09/2026. Which doses are due today and which are due soon are read from
 * the clock, so the figures below hold at this instant only (CLAUDE.md §8).
 */
vi.hoisted(() => {
  window.history.replaceState(null, '', '/m?at=2026-09-16T19:20:00Z')
})

import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { SiteId, StaffId } from '@/data/types'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import { renderSignedIn } from '@/test/render-signed-in'
import { PhoneApp } from './shell/PhoneApp'

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useParams: () => ({}),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
}))

/**
 * The Medication badge and Today's dose figures are out of the doses **due
 * today**, not every entry on today's chart. At this instant a care worker's
 * four residents have 32 chart entries today and 26 doses due; the home has 169
 * and 112. The difference is as-required drugs and cells where nothing was due.
 *
 * The figures were counted a second way at this instant before they were
 * written here: the day's records filtered on each drug's own `isPrn` and on
 * `not_due`, rather than through `owedDoses` (PROGRESS.md, 06/11/2026). Each
 * rose by four on 07/11/2026, when four residents were given an evening
 * medicine; two of the four doses are still open at 20:20.
 */
async function open(who: StaffId) {
  window.history.replaceState(null, '', '/m')
  renderSignedIn(who, <PhoneApp />, 'site-rosewood-court' as SiteId)
  const nav = screen.getByRole('navigation', { name: 'Main navigation' })
  const badge = await waitFor(
    () => {
      const found = nav.querySelector('[data-badge]')
      if (found === null) throw new Error('no badge yet')
      return found
    },
    { timeout: 6000 },
  )
  const today = document.querySelector('[data-tab="today"]') as HTMLElement
  await within(today).findByText('Already late', undefined, { timeout: 6000 })
  const stat = (label: string) =>
    within(today).getByText(label).closest('[data-stat]')?.textContent
  return { badge, today, stat }
}

describe('the badge and Today, out of the doses due today', () => {
  it('for a care worker: 6 of 26, not 6 of 32', async () => {
    const { badge, stat } = await open(staffEze.id)
    expect(badge.textContent).toBe('6')
    expect(badge.closest('a')?.getAttribute('aria-label')).toBe(
      'Medication. Due now or in the next 2 hours: 6 of 26 doses due today, on your list.',
    )
    expect(stat('Due now or in the next 2 hours')).toBe(
      'Due now or in the next 2 hours6of 26 doses due today, nothing recorded yet',
    )
    expect(stat('Doses past their window')).toBe(
      'Doses past their window1of 26 doses due today',
    )
  })

  it('for a senior carer: 21 of 112, not 21 of 169', async () => {
    const { badge, stat } = await open(staffAkinyemi.id)
    expect(badge.textContent).toBe('21')
    expect(badge.closest('a')?.getAttribute('aria-label')).toBe(
      'Medication. Due now or in the next 2 hours: 21 of 112 doses due today, on your list.',
    )
    expect(stat('Due now or in the next 2 hours')).toBe(
      'Due now or in the next 2 hours21of 112 doses due today, nothing recorded yet',
    )
    expect(stat('Doses past their window')).toBe(
      'Doses past their window4of 112 doses due today',
    )
  })
})
