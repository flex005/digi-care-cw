import { vi } from 'vitest'

/* A full instant before any fixture loads: 20:20 BST, 16/09/2026 (CLAUDE.md §8). */
vi.hoisted(() => {
  window.history.replaceState(
    null,
    '',
    '/m/people/res-lonsdale/chart?at=2026-09-16T19:20:00Z',
  )
})

import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { SiteId } from '@/data/types'
import { staffAkinyemi } from '@/data/fixtures/organisation'
import { renderSignedIn } from '@/test/render-signed-in'
import { PhoneApp } from './shell/PhoneApp'

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useParams: () => ({}),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
}))

/**
 * The dose sheet over a person whose allergies nobody has recorded. **No
 * fixture has such a person with a dose open at 20:00**, so the loader is
 * wrapped to say Lonsdale's allergies were never asked; the fixtures, which
 * both builds read, are not changed.
 */
vi.mock('@/data/access/client', async (original) => {
  const real = await original<typeof import('@/data/access/client')>()
  return {
    ...real,
    getResident: async (id: Parameters<typeof real.getResident>[0]) => {
      const person = await real.getResident(id)
      return id === 'res-lonsdale'
        ? { ...person, allergies: { kind: 'not_recorded' as const } }
        : person
    },
  }
})

describe('the dose sheet, over allergies nobody has recorded', () => {
  it('hatches them, says so in words, and still says nothing checks them', async () => {
    renderSignedIn(staffAkinyemi.id, <PhoneApp />, 'site-rosewood-court' as SiteId)
    const people = document.querySelector('[data-tab="people"]') as HTMLElement
    fireEvent.click(
      await within(people).findByRole(
        'button',
        { name: 'Record the 20:00 round' },
        { timeout: 4000 },
      ),
    )
    const sheet = await screen.findByRole('dialog', { name: /^20:00 round for / })
    const allergies = sheet.querySelector<HTMLElement>('[data-sheet-allergies]')
    expect(allergies?.dataset.sheetAllergies).toBe('not_recorded')
    expect(
      allergies?.querySelector('[data-state="unrecorded"]')?.textContent,
    ).toContain('Allergies not recorded')
    expect(allergies?.textContent).toMatch(/Nothing here checks these drugs against/)
  })
})
