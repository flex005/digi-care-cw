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
import type { Allergy, SiteId } from '@/data/types'
import { staffAkinyemi } from '@/data/fixtures/organisation'
import { renderSignedIn } from '@/test/render-signed-in'
import { PhoneApp } from './shell/PhoneApp'

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useParams: () => ({}),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
}))

/**
 * The dose sheet over a person with seven allergies. **No fixture has one**, so
 * the loader is wrapped to give Lonsdale seven; the fixtures, which both builds
 * read, are not changed.
 *
 * This holds what is in the pinned head and what is not. **Whether it fits is a
 * measurement, and jsdom has no layout**: `scripts/check-dose-sheet-fits.mjs`
 * measures the same case at 390 × 508 in a browser.
 */
const SEVEN: [Allergy, ...Allergy[]] = [
  { substance: 'Penicillin', reaction: 'Rash', severity: 'moderate' },
  { substance: 'Latex', reaction: 'Hives', severity: 'mild' },
  { substance: 'Codeine', reaction: 'Vomiting', severity: 'moderate' },
  { substance: 'Aspirin', reaction: 'Wheeze', severity: 'severe' },
  { substance: 'Ibuprofen', reaction: 'Swollen lips', severity: 'severe' },
  { substance: 'Peanut', reaction: 'Throat closing', severity: 'anaphylaxis' },
  { substance: 'Trimethoprim', reaction: 'Itching', severity: 'mild' },
]

vi.mock('@/data/access/client', async (original) => {
  const real = await original<typeof import('@/data/access/client')>()
  return {
    ...real,
    getResident: async (id: Parameters<typeof real.getResident>[0]) => {
      const person = await real.getResident(id)
      if (id !== 'res-lonsdale') return person
      if (person.allergies.kind !== 'allergies')
        throw new Error('Lonsdale’s allergies changed shape in the fixtures')
      return { ...person, allergies: { ...person.allergies, items: SEVEN } }
    },
  }
})

async function openSheet() {
  renderSignedIn(staffAkinyemi.id, <PhoneApp />, 'site-rosewood-court' as SiteId)
  const people = document.querySelector('[data-tab="people"]') as HTMLElement
  fireEvent.click(
    await within(people).findByRole(
      'button',
      { name: 'Record the 20:00 round' },
      { timeout: 4000 },
    ),
  )
  return screen.findByRole('dialog', { name: /^20:00 round for / })
}

describe('the dose sheet, over seven allergies', () => {
  it('pins every substance by name in one block, with the line saying nothing checks them', async () => {
    const sheet = await openSheet()
    const head = sheet.querySelector<HTMLElement>('[data-sheet-allergies]')
    expect(head?.dataset.sheetAllergies).toBe('allergies')
    expect(head?.querySelector('[data-tone="critical"]')?.textContent).toBe(
      'Allergies: Penicillin, Latex, Codeine, Aspirin, Ibuprofen, Peanut, Trimethoprim',
    )
    // One block, not one per allergy, and nothing standing in for the rest.
    expect(head?.querySelectorAll('[data-tone="critical"]')).toHaveLength(1)
    expect(head?.textContent).not.toMatch(/more/)
    expect(head?.textContent).toContain(
      'Nothing here checks these drugs against Vera Lonsdale’s allergies.',
    )
  })

  it('keeps the reaction and severity out of the pinned head, and opens the body with them, before the first dose', async () => {
    const sheet = await openSheet()
    const head = sheet.querySelector<HTMLElement>('[data-sheet-allergies]')
    expect(head?.textContent).not.toMatch(/Throat closing|anaphylaxis/)

    const detail = sheet.querySelector<HTMLElement>('[data-sheet-allergy-detail]')
    expect(detail?.textContent).toContain('Allergy: Peanut')
    expect(detail?.textContent).toContain('Throat closing · anaphylaxis')
    expect(detail?.textContent).toContain('Allergy: Trimethoprim')
    expect(detail?.textContent).toContain('Itching · mild')
    expect(detail?.querySelectorAll('[data-tone="critical"]')).toHaveLength(7)

    const firstDose = sheet.querySelector('[data-sheet-dose]')
    expect(firstDose).not.toBeNull()
    expect(
      detail!.compareDocumentPosition(firstDose!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(head?.contains(detail!)).toBe(false)
  })
})
