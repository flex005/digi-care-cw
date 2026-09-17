import { within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import type { StaffId } from '@/data/types'
import { renderSignedIn } from '@/test/render-signed-in'
import { InterimRoute } from './InterimRoute'

const navigation = vi.hoisted(() => ({ pathname: '/medications/interim', params: {} }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

describe('Add interim', () => {
  it.each([
    ['Akinyemi', staffAkinyemi.id],
    ['Eze', staffEze.id],
  ] as [string, StaffId][])('is drawn and refused for %s', (_, id) => {
    renderSignedIn(id, <InterimRoute />)
    const page = document.querySelector<HTMLElement>('[data-interim]')!
    expect(
      within(page).getByRole('button', { name: 'Add interim medication' }),
    ).toBeDisabled()
    const lines = page.querySelectorAll('[data-act-line]')
    expect(lines).toHaveLength(1)
    expect(lines[0]?.getAttribute('data-act-line')).toBe('refused')
    expect(lines[0]?.textContent).toBe(
      'Only a clinician or a manager adds an interim medication.',
    )
  })
})
